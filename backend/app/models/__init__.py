"""Importe aqui todos os models para o Alembic enxergá-los no autogenerate.

Exemplo (S4):
    from app.models.user import User  # noqa: F401
"""

from app.db.base import Base

__all__ = ["Base"]
