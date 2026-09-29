"""Importe aqui todos os models para o Alembic enxergá-los no autogenerate."""

from app.db.base import Base
from app.models.business import Business
from app.models.carrier import Carrier
from app.models.category import Category
from app.models.place import Place
from app.models.place_photo import PlacePhoto
from app.models.refresh_token import RefreshToken
from app.models.user import User

__all__ = [
    "Base",
    "Business",
    "Carrier",
    "Category",
    "Place",
    "PlacePhoto",
    "RefreshToken",
    "User",
]
