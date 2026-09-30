"""Extensão comercial 1:1 de um place: horários, contato, se é parceiro."""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING, Any

from sqlalchemy import Boolean, CheckConstraint, ForeignKey, String, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPkMixin

if TYPE_CHECKING:
    from app.models.place import Place
    from app.models.user import User


class Business(UUIDPkMixin, TimestampMixin, Base):
    __tablename__ = "businesses"
    __table_args__ = (
        CheckConstraint("source IN ('ficticio', 'campo', 'osm')", name="source_valido"),
        # Nem SQL NULL (NOT NULL) nem JSON null, objeto ou texto: sempre uma lista.
        CheckConstraint("jsonb_typeof(services) = 'array'", name="services_lista"),
    )

    # UNIQUE: um place tem no máximo um business (índice ix_businesses_place_id).
    place_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("places.id", ondelete="CASCADE"), nullable=False, unique=True, index=True
    )
    owner_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    whatsapp: Mapped[str | None] = mapped_column(String(30), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    # {"seg": [["09:00", "22:00"]], ...}
    opening_hours: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    price_range: Mapped[str | None] = mapped_column(String(10), nullable=True)
    # Uma forma só de dizer "sem serviços": lista vazia. none_as_null: sem ele, o SQLAlchemy
    # grava o None do Python como o JSON 'null' (não SQL NULL) e passaria pelo NOT NULL.
    services: Mapped[list[Any]] = mapped_column(
        JSONB(none_as_null=True), nullable=False, default=list, server_default=text("'[]'::jsonb")
    )
    is_partner: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    source: Mapped[str] = mapped_column(
        String(20), nullable=False, default="ficticio", server_default="ficticio"
    )

    place: Mapped[Place] = relationship(back_populates="business", single_parent=True)
    owner: Mapped[User | None] = relationship(back_populates="businesses")

    def __repr__(self) -> str:
        return f"<Business place_id={self.place_id}>"
