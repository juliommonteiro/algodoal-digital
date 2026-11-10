"""Pull do catálogo (#28): GET /sync/catalog."""

import uuid
from datetime import datetime

from pydantic import BaseModel

from app.schemas.category import CategoryRead
from app.schemas.place import PlaceRead


class CatalogoSync(BaseModel):
    """Contrato: `CatalogoSync` em frontend/src/lib/tipos.ts.

    `full`: sem `since`, é o catálogo inteiro (o celular troca tudo); com `since`, só o que
    mudou (o celular aplica por cima). `server_time` volta como `since` na próxima chamada.
    """

    server_time: datetime
    full: bool
    # Sempre inteiras: são poucas e mudam raramente.
    categories: list[CategoryRead]
    # Publicados que mudaram (ou todos, se full).
    places: list[PlaceRead]
    # Removidos ou despublicados desde `since`: o celular apaga. Vazio se full.
    removed_place_ids: list[uuid.UUID]
