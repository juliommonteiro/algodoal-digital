from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.category import CategoryRead
from app.services import catalog

router = APIRouter(prefix="/categories", tags=["catálogo"])


@router.get("", summary="Lista plana de categorias")
def listar_categorias(db: Annotated[Session, Depends(get_db)]) -> list[CategoryRead]:
    """Todas as categorias, por `sort_order` e `name`, com `parent_id`. Público."""
    return [CategoryRead.model_validate(c) for c in catalog.listar_categorias(db)]
