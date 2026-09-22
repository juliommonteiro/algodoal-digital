"""Perfil de carroceiro, 1:1 com um user."""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPkMixin

if TYPE_CHECKING:
    from app.models.user import User


class Carrier(UUIDPkMixin, TimestampMixin, Base):
    __tablename__ = "carriers"
    __table_args__ = (Index("ix_carriers_is_available", "is_available"),)

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    display_name: Mapped[str] = mapped_column(String(120), nullable=False)
    whatsapp: Mapped[str | None] = mapped_column(String(30), nullable=True)
    capacity: Mapped[int] = mapped_column(Integer, nullable=False, default=2, server_default="2")
    is_available: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    is_approved: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )

    user: Mapped[User] = relationship(back_populates="carrier")

    def __repr__(self) -> str:
        return f"<Carrier {self.display_name}>"
