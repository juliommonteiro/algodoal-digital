"""Carroça (#32 e #33): o turista pede e acompanha; o carroceiro aceita ou recusa."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.api.deps import UsuarioAtual, requer_perfil
from app.db.session import get_db
from app.models import Carrier, RideRequest, User
from app.schemas.carroca import (
    CarroceiroDoPedido,
    ContatoCarroceiro,
    PedidoDoTurista,
    PedidoIn,
    PedidoParaCarroceiro,
    PerfilCarroceiro,
    PerfilCarroceiroUpdate,
)
from app.services import carroca

Db = Annotated[Session, Depends(get_db)]

_401 = {status.HTTP_401_UNAUTHORIZED: {"description": "Não autenticado"}}
_404 = {status.HTTP_404_NOT_FOUND: {"description": "Pedido não encontrado"}}
_409 = {status.HTTP_409_CONFLICT: {"description": "Pedido não está mais disponível"}}

NAO_ENCONTRADO = "Pedido não encontrado."
SUSPENSO = "Seu perfil de carroceiro está suspenso. Fale com a equipe do Algodoal Digital."
INDISPONIVEL = (
    "Este pedido não está mais disponível: outro carroceiro aceitou, ele venceu ou foi cancelado."
)


def _erro(codigo: int, detalhe: str) -> HTTPException:
    return HTTPException(status_code=codigo, detail=detalhe)


def _do_turista(pedido: RideRequest) -> PedidoDoTurista:
    carroceiro = None
    if pedido.status == "accepted" and pedido.carrier is not None:
        carroceiro = CarroceiroDoPedido(
            display_name=pedido.carrier.display_name, whatsapp=pedido.carrier.whatsapp
        )
    return PedidoDoTurista(
        id=pedido.id,
        origin=pedido.origin,
        destination=pedido.destination,
        passengers=pedido.passengers,
        notes=pedido.notes,
        status=pedido.status,
        created_at=pedido.created_at,
        expires_at=carroca.expira_em(pedido),
        responded_at=pedido.responded_at,
        carrier=carroceiro,
    )


def _para_carroceiro(pedido: RideRequest, carroceiro: Carrier) -> PedidoParaCarroceiro:
    meu = pedido.carrier_id == carroceiro.id and pedido.status == "accepted"
    return PedidoParaCarroceiro(
        id=pedido.id,
        origin=pedido.origin,
        destination=pedido.destination,
        passengers=pedido.passengers,
        notes=pedido.notes,
        status=pedido.status,
        created_at=pedido.created_at,
        expires_at=carroca.expira_em(pedido),
        responded_at=pedido.responded_at,
        tourist_name=pedido.tourist.name,
        tourist_whatsapp=pedido.tourist_whatsapp if meu else None,
    )


# -------------------------------------------------------------------------------- turista

pedidos = APIRouter(prefix="/ride-requests", tags=["carroça"], responses=_401)


@pedidos.post(
    "",
    status_code=status.HTTP_201_CREATED,
    summary="Pede uma carroça (vai para todos os carroceiros disponíveis)",
    responses={status.HTTP_409_CONFLICT: {"description": "Já há um pedido aguardando"}},
)
def pedir(dados: PedidoIn, usuario: UsuarioAtual, db: Db) -> PedidoDoTurista:
    try:
        return _do_turista(carroca.pedir(db, usuario, dados))
    except carroca.PedidoJaAberto as exc:
        raise _erro(
            status.HTTP_409_CONFLICT,
            "Você já tem um pedido aguardando carroceiro. Cancele esse antes de pedir outro.",
        ) from exc


@pedidos.get(
    "/current",
    response_model=PedidoDoTurista,
    summary="Último pedido do usuário nas últimas horas (204 se não houver)",
    responses={status.HTTP_204_NO_CONTENT: {"description": "Nenhum pedido recente"}},
)
def pedido_atual(usuario: UsuarioAtual, db: Db) -> PedidoDoTurista | Response:
    pedido = carroca.pedido_atual(db, usuario)
    if pedido is None:
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    return _do_turista(pedido)


@pedidos.post("/{pedido_id}/cancel", summary="Cancela o próprio pedido", responses={**_404, **_409})
def cancelar(pedido_id: uuid.UUID, usuario: UsuarioAtual, db: Db) -> PedidoDoTurista:
    try:
        return _do_turista(carroca.cancelar(db, usuario, pedido_id))
    except carroca.PedidoNaoEncontrado as exc:
        raise _erro(status.HTTP_404_NOT_FOUND, NAO_ENCONTRADO) from exc
    except carroca.PedidoIndisponivel as exc:
        raise _erro(status.HTTP_409_CONFLICT, "Este pedido já não pode ser cancelado.") from exc


contatos = APIRouter(prefix="/carriers", tags=["carroça"], responses=_401)


@contatos.get("", summary="Carroceiros com WhatsApp, para chamar direto (inclusive offline)")
def listar_contatos(_: UsuarioAtual, db: Db) -> list[ContatoCarroceiro]:
    return [ContatoCarroceiro.model_validate(c) for c in carroca.contatos(db)]


# ----------------------------------------------------------------------------- carroceiro

# O perfil é exigido no router inteiro, como no /admin: rota nova não nasce desprotegida.
painel = APIRouter(
    prefix="/carrier",
    tags=["carroça"],
    dependencies=[Depends(requer_perfil("carrier"))],
    responses={**_401, status.HTTP_403_FORBIDDEN: {"description": "Só carroceiro"}},
)

Carroceiro = Annotated[User, Depends(requer_perfil("carrier"))]


def _perfil(usuario: User) -> Carrier:
    try:
        return carroca.perfil(usuario)
    except carroca.SemPerfilDeCarroceiro as exc:
        raise _erro(
            status.HTTP_404_NOT_FOUND,
            "Esta conta é de carroceiro, mas ainda não tem perfil. Fale com a equipe.",
        ) from exc


@painel.get("/me", summary="Perfil do carroceiro")
def meu_perfil(usuario: Carroceiro) -> PerfilCarroceiro:
    return PerfilCarroceiro.model_validate(_perfil(usuario))


@painel.patch("/me", summary="Liga/desliga a disponibilidade, muda capacidade ou WhatsApp")
def atualizar_perfil(
    dados: PerfilCarroceiroUpdate, usuario: Carroceiro, db: Db
) -> PerfilCarroceiro:
    return PerfilCarroceiro.model_validate(carroca.atualizar_perfil(db, _perfil(usuario), dados))


@painel.get("/requests", summary="Pedidos esperando, que cabem na carroça (vazio se indisponível)")
def pedidos_abertos(usuario: Carroceiro, db: Db) -> list[PedidoParaCarroceiro]:
    carroceiro = _perfil(usuario)
    return [_para_carroceiro(p, carroceiro) for p in carroca.pedidos_abertos(db, carroceiro)]


@painel.post(
    "/requests/{pedido_id}/accept",
    summary="Aceita o pedido; o primeiro a aceitar leva",
    responses={**_404, **_409},
)
def aceitar(pedido_id: uuid.UUID, usuario: Carroceiro, db: Db) -> PedidoParaCarroceiro:
    carroceiro = _perfil(usuario)
    try:
        return _para_carroceiro(carroca.aceitar(db, carroceiro, pedido_id), carroceiro)
    except carroca.PedidoNaoEncontrado as exc:
        raise _erro(status.HTTP_404_NOT_FOUND, NAO_ENCONTRADO) from exc
    except carroca.CarroceiroSuspenso as exc:
        raise _erro(status.HTTP_409_CONFLICT, SUSPENSO) from exc
    except carroca.CarroceiroIndisponivel as exc:
        raise _erro(status.HTTP_409_CONFLICT, "Fique disponível para aceitar pedidos.") from exc
    except carroca.CapacidadeInsuficiente as exc:
        raise _erro(
            status.HTTP_409_CONFLICT,
            "Este pedido tem mais passageiros do que cabem na sua carroça.",
        ) from exc
    except carroca.PedidoIndisponivel as exc:
        raise _erro(status.HTTP_409_CONFLICT, INDISPONIVEL) from exc


@painel.post(
    "/requests/{pedido_id}/decline",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Recusa: o pedido sai da sua lista e continua para os outros",
    responses={**_404, **_409},
)
def recusar(pedido_id: uuid.UUID, usuario: Carroceiro, db: Db) -> None:
    try:
        carroca.recusar(db, _perfil(usuario), pedido_id)
    except carroca.PedidoNaoEncontrado as exc:
        raise _erro(status.HTTP_404_NOT_FOUND, NAO_ENCONTRADO) from exc
    except carroca.PedidoIndisponivel as exc:
        raise _erro(status.HTTP_409_CONFLICT, INDISPONIVEL) from exc


@painel.get("/rides", summary="Viagens aceitas nos últimos 7 dias")
def viagens(usuario: Carroceiro, db: Db) -> list[PedidoParaCarroceiro]:
    carroceiro = _perfil(usuario)
    return [_para_carroceiro(p, carroceiro) for p in carroca.viagens(db, carroceiro)]
