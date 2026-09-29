"""Token de renovação emitido. Guardar o jti é o que permite revogar e detectar reuso."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, UUIDPkMixin


class RefreshToken(UUIDPkMixin, Base):
    __tablename__ = "refresh_tokens"

    # UNIQUE + índice numa coisa só (ix_refresh_tokens_jti): é a busca de todo /refresh.
    jti: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    # Preenchido na rotação, no logout ou quando o reuso derruba todas as sessões.
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    def __repr__(self) -> str:
        return f"<RefreshToken {self.jti} user={self.user_id} revogado={self.revoked_at}>"
