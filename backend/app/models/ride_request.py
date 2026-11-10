"""Pedido de carroça (PRD, seção 11): o turista pede, os carroceiros disponíveis veem, o
primeiro que aceitar leva. Sem pagamento e sem GPS no app: depois do aceite, a conversa segue
pelo WhatsApp."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPkMixin

if TYPE_CHECKING:
    from app.models.carrier import Carrier
    from app.models.user import User

# 'declined' fica no enum do modelo de dados, mas recusar não muda o pedido: ele vai para todos,
# e a recusa de um carroceiro só o tira da lista dele (RideDecline).
RIDE_STATUSES = ("pending", "accepted", "declined", "cancelled", "expired")


class RideRequest(UUIDPkMixin, TimestampMixin, Base):
    __tablename__ = "ride_requests"
    __table_args__ = (
        CheckConstraint(
            "status IN ('pending', 'accepted', 'declined', 'cancelled', 'expired')",
            name="status_valido",
        ),
        CheckConstraint("passengers >= 1", name="passengers_positivo"),
        Index("ix_ride_requests_carrier_id_status", "carrier_id", "status"),
        Index("ix_ride_requests_status_created_at", "status", "created_at"),
        Index("ix_ride_requests_tourist_id_created_at", "tourist_id", "created_at"),
    )

    tourist_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    carrier_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("carriers.id", ondelete="SET NULL"), nullable=True
    )
    origin: Mapped[str] = mapped_column(String(160), nullable=False)
    destination: Mapped[str] = mapped_column(String(160), nullable=False)
    passengers: Mapped[int] = mapped_column(Integer, nullable=False)
    # Horário e observações num texto só, como no protótipo ("Agora · duas malas grandes").
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Para o carroceiro que aceitar falar com o turista: o cadastro de turista não pede telefone.
    tourist_whatsapp: Mapped[str] = mapped_column(String(30), nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="pending", server_default="pending"
    )
    responded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    tourist: Mapped[User] = relationship()
    carrier: Mapped[Carrier | None] = relationship()

    def __repr__(self) -> str:
        return f"<RideRequest {self.origin} → {self.destination} ({self.status})>"


class RideDecline(Base):
    """Carroceiro que recusou um pedido: o pedido some da lista dele e continua para os outros."""

    __tablename__ = "ride_request_declines"

    ride_request_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("ride_requests.id", ondelete="CASCADE"), primary_key=True
    )
    carrier_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("carriers.id", ondelete="CASCADE"), primary_key=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
