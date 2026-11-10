"""negócio e fotos marcam o local como alterado

O pull incremental do catálogo (#28, GET /sync/catalog?since=) usa places.updated_at para saber
o que mandar para o celular. Mudar só o horário (businesses) ou só uma foto (place_photos) não
mexia na linha de places, e o celular nunca ficava sabendo. Estes triggers tocam o local depois
de qualquer INSERT, UPDATE ou DELETE nas duas tabelas, venha a mudança do painel, do parceiro ou
de um psql. O trigger de places (67a9dd9c4314) põe o clock_timestamp() no updated_at.

Revision ID: a33968362746
Revises: beb6eb0e132f
Create Date: 2026-11-10 16:00:00.000000
"""
from collections.abc import Sequence

from alembic import op


revision: str = 'a33968362746'
down_revision: str | None = 'beb6eb0e132f'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

TABELAS = ("businesses", "place_photos")


def upgrade() -> None:
    op.execute(
        """
        CREATE OR REPLACE FUNCTION tocar_local() RETURNS trigger AS $$
        BEGIN
            IF TG_OP IN ('UPDATE', 'DELETE') THEN
                UPDATE places SET updated_at = clock_timestamp() WHERE id = OLD.place_id;
            END IF;
            IF TG_OP IN ('INSERT', 'UPDATE') AND (TG_OP = 'INSERT' OR NEW.place_id <> OLD.place_id) THEN
                UPDATE places SET updated_at = clock_timestamp() WHERE id = NEW.place_id;
            END IF;
            RETURN NULL;
        END;
        $$ LANGUAGE plpgsql;
        """
    )
    for tabela in TABELAS:
        op.execute(
            f"""
            CREATE TRIGGER trg_{tabela}_tocar_local
            AFTER INSERT OR UPDATE OR DELETE ON {tabela}
            FOR EACH ROW EXECUTE FUNCTION tocar_local();
            """
        )


def downgrade() -> None:
    for tabela in TABELAS:
        op.execute(f"DROP TRIGGER IF EXISTS trg_{tabela}_tocar_local ON {tabela};")
    op.execute("DROP FUNCTION IF EXISTS tocar_local();")
