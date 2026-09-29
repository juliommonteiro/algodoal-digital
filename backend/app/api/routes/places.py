import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.place import PlaceKind, PlaceRead
from app.services import catalog

router = APIRouter(prefix="/places", tags=["catálogo"])


@router.get("", summary="Lista locais publicados")
def listar_locais(
    db: Annotated[Session, Depends(get_db)],
    category: Annotated[
        str | None,
        Query(description="Slug da categoria; inclui as subcategorias. Inexistente = lista vazia."),
    ] = None,
    kind: Annotated[PlaceKind | None, Query(description="Tipo do local.")] = None,
) -> list[PlaceRead]:
    """Locais publicados e não removidos, por nome, com negócio e fotos. Público."""
    locais = catalog.listar_locais(db, category=category, kind=kind)
    return [PlaceRead.model_validate(local) for local in locais]


@router.get(
    "/{place_id}",
    summary="Detalhe de um local",
    responses={status.HTTP_404_NOT_FOUND: {"description": "Local não encontrado"}},
)
def obter_local(place_id: uuid.UUID, db: Annotated[Session, Depends(get_db)]) -> PlaceRead:
    """Um local publicado, com negócio e fotos. Não publicado ou removido responde 404. Público."""
    local = catalog.obter_local(db, place_id)
    if local is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Local não encontrado.")
    return PlaceRead.model_validate(local)
