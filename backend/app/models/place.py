"""Tudo que aparece no mapa: praias, trilhas, pontos turísticos, comércios, pontos de coleta."""

from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPkMixin

if TYPE_CHECKING:
    from app.models.business import Business
    from app.models.category import Category
    from app.models.place_photo import PlacePhoto

PLACE_KINDS = (
    "beach",
    "trail",
    "tourist_point",
    "experience",
    "business",
    "collection_point",
    "culture",
)
# 'ficticio' = dado de demonstração; 'campo' = levantado na validação em campo;
# 'osm' = importado do OpenStreetMap.
SOURCES = ("ficticio", "campo", "osm")


class Place(UUIDPkMixin, TimestampMixin, Base):
    __tablename__ = "places"
    __table_args__ = (
        CheckConstraint(
            "kind IN ('beach', 'trail', 'tourist_point', 'experience', "
            "'business', 'collection_point', 'culture')",
            name="kind_valido",
        ),
        CheckConstraint("source IN ('ficticio', 'campo', 'osm')", name="source_valido"),
        Index("ix_places_category_id", "category_id"),
        Index("ix_places_updated_at", "updated_at"),
        Index("ix_places_kind", "kind"),
    )

    category_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("categories.id", ondelete="RESTRICT"), nullable=False
    )
    kind: Mapped[str] = mapped_column(String(30), nullable=False)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    latitude: Mapped[Decimal] = mapped_column(Numeric(9, 6), nullable=False)
    longitude: Mapped[Decimal] = mapped_column(Numeric(9, 6), nullable=False)
    is_published: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    source: Mapped[str] = mapped_column(
        String(20), nullable=False, default="ficticio", server_default="ficticio"
    )
    # Soft delete: o pull do catálogo precisa avisar o celular que o local sumiu.
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    category: Mapped[Category] = relationship(back_populates="places")
    photos: Mapped[list[PlacePhoto]] = relationship(
        back_populates="place", cascade="all, delete-orphan"
    )
    business: Mapped[Business | None] = relationship(
        back_populates="place", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Place {self.name} ({self.kind})>"
