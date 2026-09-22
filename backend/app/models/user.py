"""Usuário da plataforma: turista, carroceiro, parceiro ou admin."""

from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import Boolean, CheckConstraint, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPkMixin

if TYPE_CHECKING:
    from app.models.business import Business
    from app.models.carrier import Carrier

USER_ROLES = ("tourist", "carrier", "partner", "admin")


class User(UUIDPkMixin, TimestampMixin, Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint(
            "role IN ('tourist', 'carrier', 'partner', 'admin')",
            name="role_valido",
        ),
    )

    name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    # Autenticação é da S5; por enquanto ninguém tem senha.
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    role: Mapped[str] = mapped_column(
        String(20), nullable=False, default="tourist", server_default="tourist"
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )

    carrier: Mapped[Carrier | None] = relationship(back_populates="user")
    businesses: Mapped[list[Business]] = relationship(back_populates="owner")

    def __repr__(self) -> str:
        return f"<User {self.email} ({self.role})>"
