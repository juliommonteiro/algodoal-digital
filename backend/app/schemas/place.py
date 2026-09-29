import uuid
from datetime import datetime
from typing import Any, Literal, get_args

from pydantic import BaseModel, ConfigDict, field_validator

from app.models.place import PLACE_KINDS

# Mesmos valores do CheckConstraint de places.kind; o assert abaixo impede que divirjam.
PlaceKind = Literal[
    "beach",
    "trail",
    "tourist_point",
    "experience",
    "business",
    "collection_point",
    "culture",
]
assert set(get_args(PlaceKind)) == set(PLACE_KINDS), "PlaceKind fora de sincronia com o model"


class PhotoRead(BaseModel):
    """Contrato: `Foto`."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    storage_key: str
    position: int


class BusinessRead(BaseModel):
    """Contrato: `Negocio`. Sem `source`, `owner_id` e ids internos."""

    model_config = ConfigDict(from_attributes=True)

    whatsapp: str | None
    phone: str | None
    # {"seg": [["09:00", "22:00"]], ...}; dia ausente = fechado.
    opening_hours: dict[str, list[tuple[str, str]]] | None
    price_range: str | None
    services: list[str]
    is_partner: bool

    @field_validator("services", mode="before")
    @classmethod
    def _servicos_nulos_viram_lista(cls, valor: Any) -> Any:
        # No banco a coluna aceita NULL; o contrato promete sempre uma lista.
        return [] if valor is None else valor


class PlaceRead(BaseModel):
    """Contrato: `Local`. `source` (marca de dado fictício) e `deleted_at` são internos."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    description: str | None
    kind: PlaceKind
    category_id: uuid.UUID
    # Numeric(9, 6) no banco; float aqui para sair como número no JSON (Decimal sairia string).
    latitude: float
    longitude: float
    is_published: bool
    updated_at: datetime
    business: BusinessRead | None
    photos: list[PhotoRead]
