"""Pedido de carroça (#32 e #33).

O pedido vai para todos os carroceiros disponíveis com capacidade para os passageiros, e o
primeiro que aceitar leva. Recusar só tira o pedido da lista de quem recusou. Pendente vence
em VALIDADE: um pedido de três horas atrás não serve para ninguém (docs/arquitetura.md). O
vencimento é aplicado na leitura, sem job: toda operação começa por expirar_vencidos().
"""

import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import exists, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.models import Carrier, RideDecline, RideRequest, User
from app.schemas.carroca import PedidoIn, PerfilCarroceiroUpdate

VALIDADE = timedelta(minutes=10)
# O turista vê o último pedido dele por algumas horas: tempo de combinar e fazer a viagem.
JANELA_DO_PEDIDO_ATUAL = timedelta(hours=6)
JANELA_DO_HISTORICO = timedelta(days=7)


class PedidoNaoEncontrado(Exception):
    pass


class PedidoJaAberto(Exception):
    """O turista já tem um pedido esperando carroceiro."""


class PedidoIndisponivel(Exception):
    """Outro carroceiro aceitou, o pedido venceu ou foi cancelado."""


class CarroceiroIndisponivel(Exception):
    pass


class CarroceiroSuspenso(Exception):
    """Suspenso pelo admin: não recebe nem aceita pedidos."""


class CapacidadeInsuficiente(Exception):
    pass


class SemPerfilDeCarroceiro(Exception):
    pass


def _agora() -> datetime:
    return datetime.now(UTC)


def expira_em(pedido: RideRequest) -> datetime:
    return pedido.created_at + VALIDADE


def expirar_vencidos(db: Session) -> None:
    db.execute(
        update(RideRequest)
        .where(RideRequest.status == "pending", RideRequest.created_at < _agora() - VALIDADE)
        .values(status="expired")
    )


# ---------------------------------------------------------------------------------- turista


def pedir(db: Session, turista: User, dados: PedidoIn) -> RideRequest:
    expirar_vencidos(db)
    aberto = select(
        exists().where(RideRequest.tourist_id == turista.id, RideRequest.status == "pending")
    )
    if db.scalar(aberto):
        db.commit()
        raise PedidoJaAberto
    pedido = RideRequest(
        tourist_id=turista.id,
        origin=dados.origin,
        destination=dados.destination,
        passengers=dados.passengers,
        notes=dados.notes or None,
        tourist_whatsapp=dados.whatsapp,
    )
    db.add(pedido)
    db.commit()
    db.refresh(pedido)
    return pedido


def pedido_atual(db: Session, turista: User) -> RideRequest | None:
    """O último pedido das últimas horas, menos os cancelados: cancelar volta ao formulário."""
    expirar_vencidos(db)
    db.commit()
    return db.scalar(
        select(RideRequest)
        .where(
            RideRequest.tourist_id == turista.id,
            RideRequest.created_at >= _agora() - JANELA_DO_PEDIDO_ATUAL,
            RideRequest.status != "cancelled",
        )
        .order_by(RideRequest.created_at.desc())
        .limit(1)
    )


def cancelar(db: Session, turista: User, pedido_id: uuid.UUID) -> RideRequest:
    expirar_vencidos(db)
    pedido = db.get(RideRequest, pedido_id)
    if pedido is None or pedido.tourist_id != turista.id:
        raise PedidoNaoEncontrado
    if pedido.status not in ("pending", "accepted"):
        db.commit()
        raise PedidoIndisponivel
    pedido.status = "cancelled"
    db.commit()
    db.refresh(pedido)
    return pedido


def contatos(db: Session) -> list[Carrier]:
    """Carroceiros para chamar direto pelo WhatsApp (sem internet, ou se ninguém aceitar)."""
    return list(
        db.scalars(
            select(Carrier)
            .where(Carrier.is_approved.is_(True), Carrier.whatsapp.is_not(None))
            .order_by(Carrier.is_available.desc(), Carrier.display_name)
        )
    )


# ------------------------------------------------------------------------------- carroceiro


def perfil(usuario: User) -> Carrier:
    if usuario.carrier is None:
        raise SemPerfilDeCarroceiro
    return usuario.carrier


def atualizar_perfil(db: Session, carroceiro: Carrier, dados: PerfilCarroceiroUpdate) -> Carrier:
    for campo in ("is_available", "capacity", "whatsapp"):
        valor = getattr(dados, campo)
        if campo in dados.model_fields_set and valor is not None:
            setattr(carroceiro, campo, valor)
    if not carroceiro.is_approved:
        carroceiro.is_available = False  # suspenso não fica disponível nem se ligar
    db.commit()
    db.refresh(carroceiro)
    return carroceiro


def _recusado_por(carroceiro: Carrier):
    return exists().where(
        RideDecline.ride_request_id == RideRequest.id, RideDecline.carrier_id == carroceiro.id
    )


def pedidos_abertos(db: Session, carroceiro: Carrier) -> list[RideRequest]:
    """Pendentes que cabem na carroça, menos os recusados e os do próprio carroceiro. Quem está
    indisponível ou suspenso não recebe nada."""
    expirar_vencidos(db)
    db.commit()
    if not carroceiro.is_available or not carroceiro.is_approved:
        return []
    return list(
        db.scalars(
            select(RideRequest)
            .where(
                RideRequest.status == "pending",
                RideRequest.passengers <= carroceiro.capacity,
                RideRequest.tourist_id != carroceiro.user_id,
                ~_recusado_por(carroceiro),
            )
            .order_by(RideRequest.created_at)
        )
    )


def aceitar(db: Session, carroceiro: Carrier, pedido_id: uuid.UUID) -> RideRequest:
    """O primeiro que aceitar leva: o UPDATE só pega o pedido se ele ainda estiver pendente.
    No PostgreSQL, o segundo UPDATE concorrente espera o primeiro e não encontra mais a linha."""
    expirar_vencidos(db)
    if not carroceiro.is_approved:
        db.commit()
        raise CarroceiroSuspenso
    if not carroceiro.is_available:
        db.commit()
        raise CarroceiroIndisponivel
    aceito = db.execute(
        update(RideRequest)
        .where(
            RideRequest.id == pedido_id,
            RideRequest.status == "pending",
            RideRequest.passengers <= carroceiro.capacity,
            RideRequest.tourist_id != carroceiro.user_id,
        )
        .values(status="accepted", carrier_id=carroceiro.id, responded_at=_agora())
        .returning(RideRequest.id)
    ).scalar_one_or_none()
    if aceito is None:
        pedido = db.get(RideRequest, pedido_id)
        db.commit()
        if pedido is None or pedido.tourist_id == carroceiro.user_id:
            raise PedidoNaoEncontrado
        if pedido.status == "pending" and pedido.passengers > carroceiro.capacity:
            raise CapacidadeInsuficiente
        raise PedidoIndisponivel
    db.commit()
    pedido = db.get(RideRequest, pedido_id)
    db.refresh(pedido)
    return pedido


def recusar(db: Session, carroceiro: Carrier, pedido_id: uuid.UUID) -> None:
    expirar_vencidos(db)
    pedido = db.get(RideRequest, pedido_id)
    if pedido is None or pedido.tourist_id == carroceiro.user_id:
        db.commit()
        raise PedidoNaoEncontrado
    if pedido.status != "pending":
        db.commit()
        raise PedidoIndisponivel
    db.execute(
        insert(RideDecline)
        .values(ride_request_id=pedido.id, carrier_id=carroceiro.id)
        .on_conflict_do_nothing()
    )
    db.commit()


def viagens(db: Session, carroceiro: Carrier) -> list[RideRequest]:
    """Aceitas pelo carroceiro nos últimos dias (inclusive as que o turista cancelou depois)."""
    return list(
        db.scalars(
            select(RideRequest)
            .where(
                RideRequest.carrier_id == carroceiro.id,
                RideRequest.created_at >= _agora() - JANELA_DO_HISTORICO,
            )
            .order_by(RideRequest.created_at.desc())
        )
    )
