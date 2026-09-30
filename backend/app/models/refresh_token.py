"""Token de renovação emitido. Guardar o jti é o que permite revogar e detectar reuso."""

import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, UUIDPkMixin

# rotation: trocado por outro no /refresh (replaced_by_jti aponta o sucessor);
# logout: encerrado pelo dono; reuse: derrubado porque um token vazado reapareceu.
REVOKED_REASONS = ("rotation", "logout", "reuse")


class RefreshToken(UUIDPkMixin, Base):
    __tablename__ = "refresh_tokens"
    __table_args__ = (
        CheckConstraint(
            "revoked_reason IN ('rotation', 'logout', 'reuse')", name="revoked_reason_valido"
        ),
        # Revogado sempre com motivo, e motivo só em revogado.
        CheckConstraint(
            "(revoked_at IS NULL) = (revoked_reason IS NULL)", name="revogacao_com_motivo"
        ),
        # Só a rotação tem sucessor.
        CheckConstraint(
            "replaced_by_jti IS NULL OR revoked_reason = 'rotation'",
            name="sucessor_so_na_rotacao",
        ),
    )

    # UNIQUE + índice numa coisa só (ix_refresh_tokens_jti): é a busca de todo /refresh.
    jti: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    revoked_reason: Mapped[str | None] = mapped_column(String(20), nullable=True)
    # jti do token que substituiu este na rotação: é por ele que a janela de graça devolve o
    # par certo, e que uma cadeia de rotações pode ser seguida.
    replaced_by_jti: Mapped[str | None] = mapped_column(String(64), nullable=True)
    # Também é o `iat` dos tokens da sessão (gravado em segundos exatos): junto com o jti,
    # basta para remontar o par (security.montar_par).
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    def __repr__(self) -> str:
        return f"<RefreshToken {self.jti} user={self.user_id} revogado={self.revoked_reason}>"
