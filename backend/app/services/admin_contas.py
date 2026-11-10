"""Painel admin: usuários e carroceiros.

Travas de segurança:
- o admin não muda a própria conta (desativar ou tirar o próprio admin o trancaria para fora).
  Com isso sempre sobra um admin ativo: quem fez a mudança;
- o perfil só alterna entre turista e admin: carroceiro e parceiro vêm dos dados (cadastro de
  carroceiro, e-mail do dono no estabelecimento), e trocá-los aqui deixaria a conta sem o
  perfil correspondente.
"""

import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, or_, select, update
from sqlalchemy.orm import Session

from app.models import Business, Carrier, RefreshToken, RideRequest, User
from app.schemas.admin_contas import (
    CarroceiroAdminRead,
    CarroceiroAdminUpdate,
    StatusCarroceiro,
    StatusConta,
    UsuarioAdminRead,
    UsuarioAdminUpdate,
)


class ContaNaoEncontrada(Exception):
    pass


class PropriaConta(Exception):
    pass


class PerfilDoCadastro(Exception):
    """Carroceiro ou parceiro: o perfil vem dos dados, não se troca no painel."""

    def __init__(self, perfil: str) -> None:
        super().__init__(perfil)
        self.perfil = perfil


def _termo(busca: str | None) -> str | None:
    if not busca or not busca.strip():
        return None
    limpo = busca.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{limpo}%"


# ---------------------------------------------------------------------------------- usuários


def _usuario_read(db: Session, usuario: User) -> UsuarioAdminRead:
    estabelecimentos = db.scalar(
        select(func.count()).select_from(Business).where(Business.owner_id == usuario.id)
    )
    return UsuarioAdminRead(
        id=usuario.id,
        name=usuario.name,
        email=usuario.email,
        role=usuario.role,
        is_active=usuario.is_active,
        created_at=usuario.created_at,
        estabelecimentos=estabelecimentos or 0,
        tem_perfil_de_carroceiro=usuario.carrier is not None,
    )


def listar_usuarios(
    db: Session,
    *,
    perfil: str | None = None,
    status: StatusConta | None = None,
    busca: str | None = None,
) -> list[UsuarioAdminRead]:
    consulta = select(User)
    if perfil:
        consulta = consulta.where(User.role == perfil)
    if status:
        consulta = consulta.where(User.is_active.is_(status == "ativa"))
    termo = _termo(busca)
    if termo:
        consulta = consulta.where(
            or_(User.name.ilike(termo, escape="\\"), User.email.ilike(termo, escape="\\"))
        )
    usuarios = db.scalars(consulta.order_by(User.name, User.email))
    return [_usuario_read(db, u) for u in usuarios]


def atualizar_usuario(
    db: Session, admin: User, user_id: uuid.UUID, dados: UsuarioAdminUpdate
) -> UsuarioAdminRead:
    usuario = db.get(User, user_id)
    if usuario is None:
        raise ContaNaoEncontrada
    if usuario.id == admin.id:
        raise PropriaConta
    enviados = dados.model_fields_set
    novo_perfil = dados.role if "role" in enviados and dados.role else usuario.role
    if novo_perfil != usuario.role and usuario.role in ("carrier", "partner"):
        raise PerfilDoCadastro(usuario.role)
    desativa = "is_active" in enviados and dados.is_active is False
    usuario.role = novo_perfil
    if "is_active" in enviados and dados.is_active is not None:
        usuario.is_active = dados.is_active
    if desativa:
        # Sai na hora de todos os aparelhos. Motivo 'logout': reapresentar o token é só 401.
        db.execute(
            update(RefreshToken)
            .where(RefreshToken.user_id == usuario.id, RefreshToken.revoked_at.is_(None))
            .values(revoked_at=datetime.now(UTC), revoked_reason="logout")
        )
    db.commit()
    db.refresh(usuario)
    return _usuario_read(db, usuario)


# -------------------------------------------------------------------------------- carroceiros


def _carroceiro_read(db: Session, carroceiro: Carrier) -> CarroceiroAdminRead:
    viagens = db.scalar(
        select(func.count())
        .select_from(RideRequest)
        .where(
            RideRequest.carrier_id == carroceiro.id,
            RideRequest.status == "accepted",
            RideRequest.created_at >= datetime.now(UTC) - timedelta(days=7),
        )
    )
    return CarroceiroAdminRead(
        id=carroceiro.id,
        user_id=carroceiro.user_id,
        display_name=carroceiro.display_name,
        email=carroceiro.user.email,
        whatsapp=carroceiro.whatsapp,
        capacity=carroceiro.capacity,
        is_available=carroceiro.is_available,
        is_approved=carroceiro.is_approved,
        conta_ativa=carroceiro.user.is_active,
        viagens_7_dias=viagens or 0,
        created_at=carroceiro.created_at,
    )


def listar_carroceiros(
    db: Session, *, status: StatusCarroceiro | None = None, busca: str | None = None
) -> list[CarroceiroAdminRead]:
    consulta = select(Carrier).join(Carrier.user)
    if status:
        consulta = consulta.where(Carrier.is_approved.is_(status == "aprovado"))
    termo = _termo(busca)
    if termo:
        consulta = consulta.where(
            or_(
                Carrier.display_name.ilike(termo, escape="\\"),
                User.email.ilike(termo, escape="\\"),
                Carrier.whatsapp.ilike(termo, escape="\\"),
            )
        )
    carroceiros = db.scalars(consulta.order_by(Carrier.display_name))
    return [_carroceiro_read(db, c) for c in carroceiros]


def atualizar_carroceiro(
    db: Session, carrier_id: uuid.UUID, dados: CarroceiroAdminUpdate
) -> CarroceiroAdminRead:
    carroceiro = db.get(Carrier, carrier_id)
    if carroceiro is None:
        raise ContaNaoEncontrada
    for campo in ("display_name", "whatsapp", "capacity", "is_approved"):
        valor = getattr(dados, campo)
        if campo in dados.model_fields_set and valor is not None:
            setattr(carroceiro, campo, valor)
    if dados.is_approved is False:
        carroceiro.is_available = False  # suspenso não aparece como disponível
    db.commit()
    db.refresh(carroceiro)
    return _carroceiro_read(db, carroceiro)
