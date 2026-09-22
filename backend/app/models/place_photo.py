"""Fotos de um local. A imagem em si fica no storage; aqui só a chave."""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPkMixin

if TYPE_CHECKING:
    from app.models.place import Place


class PlacePhoto(UUIDPkMixin, TimestampMixin, Base):
    __tablename__ = "place_photos"

    place_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("places.id", ondelete="CASCADE"), nullable=False, index=True
    )
    storage_key: Mapped[str] = mapped_column(String(255), nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")

    place: Mapped[Place] = relationship(back_populates="photos")

    def __repr__(self) -> str:
        return f"<PlacePhoto {self.storage_key}>"
