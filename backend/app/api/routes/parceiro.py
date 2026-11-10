"""Painel do parceiro (#26): os estabelecimentos que o admin ligou a esta conta."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import requer_perfil
from app.api.fotos import registrar_rotas_de_fotos
from app.db.session import get_db
from app.models import Place, User
from app.schemas.parceiro import NegocioDoParceiroUpdate
from app.schemas.place import PlaceRead
from app.services import parceiro

# O perfil é exigido no router inteiro, como no /admin e no /carrier.
router = APIRouter(
    prefix="/partner",
    tags=["parceiro"],
    dependencies=[Depends(requer_perfil("partner"))],
    responses={
        status.HTTP_401_UNAUTHORIZED: {"description": "Não autenticado"},
        status.HTTP_403_FORBIDDEN: {"description": "Só parceiro"},
    },
)

Db = Annotated[Session, Depends(get_db)]
Parceiro = Annotated[User, Depends(requer_perfil("partner"))]
_404 = {status.HTTP_404_NOT_FOUND: {"description": "Estabelecimento não encontrado"}}


def _nao_encontrado() -> HTTPException:
    return HTTPException(status.HTTP_404_NOT_FOUND, detail="Estabelecimento não encontrado.")


@router.get("/places", summary="Estabelecimentos desta conta (inclusive os não publicados)")
def listar(usuario: Parceiro, db: Db) -> list[PlaceRead]:
    return [PlaceRead.model_validate(local) for local in parceiro.listar(db, usuario)]


@router.get("/places/{place_id}", summary="Um estabelecimento desta conta", responses=_404)
def obter(place_id: uuid.UUID, usuario: Parceiro, db: Db) -> PlaceRead:
    try:
        return PlaceRead.model_validate(parceiro.obter(db, usuario, place_id))
    except parceiro.NegocioNaoEncontrado as exc:
        raise _nao_encontrado() from exc


def _local_do_parceiro(place_id: uuid.UUID, usuario: Parceiro, db: Db) -> Place:
    """Só os estabelecimentos desta conta; de outra pessoa ou removido: 404."""
    try:
        return parceiro.obter(db, usuario, place_id)
    except parceiro.NegocioNaoEncontrado as exc:
        raise _nao_encontrado() from exc


registrar_rotas_de_fotos(router, _local_do_parceiro)


@router.patch(
    "/places/{place_id}",
    summary="Edita descrição, horários, contatos, serviços, preço e publicação",
    responses=_404,
)
def atualizar(
    place_id: uuid.UUID, dados: NegocioDoParceiroUpdate, usuario: Parceiro, db: Db
) -> PlaceRead:
    try:
        return PlaceRead.model_validate(parceiro.atualizar(db, usuario, place_id, dados))
    except parceiro.NegocioNaoEncontrado as exc:
        raise _nao_encontrado() from exc
