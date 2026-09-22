"""trigger de updated_at

Mantém `updated_at` no banco, não só no ORM: a sincronização offline usa esse campo
para decidir o que mandar para o celular, e alteração feita direto no banco (psql,
script de correção, admin) também precisa marcar a linha.

Usa clock_timestamp() e não now(): now() é o horário de início da transação, então
dois UPDATEs na mesma transação ficariam com o mesmo updated_at.

Revision ID: 67a9dd9c4314
Revises: 464d73917a9a
Create Date: 2026-09-22 18:29:48.000000
"""
from collections.abc import Sequence

from alembic import op

revision: str = '67a9dd9c4314'
down_revision: str | None = '464d73917a9a'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

TABELAS_COM_UPDATED_AT = (
    "users",
    "categories",
    "places",
    "place_photos",
    "businesses",
    "carriers",
)


def upgrade() -> None:
    op.execute(
        """
        CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
        BEGIN
            NEW.updated_at = clock_timestamp();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        """
    )
    for tabela in TABELAS_COM_UPDATED_AT:
        op.execute(
            f"""
            CREATE TRIGGER trg_{tabela}_set_updated_at
            BEFORE UPDATE ON {tabela}
            FOR EACH ROW EXECUTE FUNCTION set_updated_at();
            """
        )


def downgrade() -> None:
    for tabela in TABELAS_COM_UPDATED_AT:
        op.execute(f"DROP TRIGGER IF EXISTS trg_{tabela}_set_updated_at ON {tabela};")
    op.execute("DROP FUNCTION IF EXISTS set_updated_at();")
