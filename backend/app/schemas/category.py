import uuid

from pydantic import BaseModel, ConfigDict


class CategoryRead(BaseModel):
    """Contrato: `Categoria` em frontend/src/lib/tipos.ts. A árvore quem monta é o cliente."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    slug: str
    name: str
    icon: str | None
    parent_id: uuid.UUID | None
    sort_order: int
