"""tira as fotos fictícias

O seed antigo criou três linhas em place_photos com chaves 'ficticio/...', que apontam para
arquivos que nunca existiram: o painel contava "1 foto" e o turista via "sem foto ainda".
Com o envio de fotos de verdade (#29), essas linhas saem. As fotos que restarem são
renumeradas a partir de 0 em cada local (a de position 0 é a capa).

Só dados. O downgrade não recria: eram só marcadores sem arquivo.

Revision ID: beb6eb0e132f
Revises: e3922be3af6e
Create Date: 2026-11-10 15:00:00.000000
"""
from collections.abc import Sequence

from alembic import op


revision: str = 'beb6eb0e132f'
down_revision: str | None = 'e3922be3af6e'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("DELETE FROM place_photos WHERE storage_key LIKE 'ficticio/%'")
    op.execute(
        """
        UPDATE place_photos AS f SET position = n.nova
        FROM (
            SELECT id, row_number() OVER (PARTITION BY place_id ORDER BY position, created_at) - 1
                AS nova
            FROM place_photos
        ) AS n
        WHERE f.id = n.id AND f.position <> n.nova
        """
    )


def downgrade() -> None:
    pass
