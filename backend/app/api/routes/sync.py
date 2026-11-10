"""Pull do catálogo para o celular (#28, docs/arquitetura.md, "Offline e sincronização")."""

from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.category import CategoryRead
from app.schemas.place import PlaceRead
from app.schemas.sync import CatalogoSync
from app.services import catalog

router = APIRouter(prefix="/sync", tags=["sincronização"])


@router.get("/catalog", summary="Catálogo para o celular: inteiro, ou só o que mudou desde `since`")
def catalogo(
    db: Annotated[Session, Depends(get_db)],
    since: Annotated[
        datetime | None,
        Query(description="`server_time` da última sincronização (ISO 8601, com fuso)."),
    ] = None,
) -> CatalogoSync:
    """Público, como o mapa e o diretório: quem não tem conta também usa o app sem internet.
    O catálogo é só leitura para o turista, então o servidor sempre vence."""
    mudancas = catalog.mudancas_do_catalogo(db, since)
    return CatalogoSync(
        server_time=mudancas.server_time,
        full=mudancas.full,
        categories=[CategoryRead.model_validate(c) for c in mudancas.categorias],
        places=[PlaceRead.model_validate(p) for p in mudancas.locais],
        removed_place_ids=mudancas.removidos,
    )
