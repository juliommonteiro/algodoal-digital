"""catálogo inicial vira dado da equipe

Os locais e estabelecimentos do seed deixam de ser demonstração: a equipe passa a manter esse
catálogo à mão pelo painel admin. Nos bancos que já existem:
- a frase "Local fictício." (ou "Estabelecimento", "Evento", "Ponto", "Experiência fictícia")
  sai do fim das descrições;
- source 'ficticio' vira 'campo', o mesmo valor do que entra pelo painel. Assim o seed não
  mexe mais nesses locais.

Só dados: o esquema não muda. O downgrade não desfaz, porque depois da migração não dá para
saber quais linhas eram 'ficticio' nem quais descrições tinham a frase.

Revision ID: f2826dbef7db
Revises: 0644c2764959
Create Date: 2026-11-10 12:00:00.000000
"""
from collections.abc import Sequence

from alembic import op


revision: str = 'f2826dbef7db'
down_revision: str | None = '0644c2764959'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Mesma regra usada para limpar o seed e o mock: só a frase no fim da descrição.
FRASE_FICTICIA = r'\s*(Local|Estabelecimento|Evento|Ponto|Experiência) fictíci[oa]\.\s*$'


def upgrade() -> None:
    op.execute(
        f"UPDATE places SET description = NULLIF(regexp_replace(description, '{FRASE_FICTICIA}', ''), '') "
        f"WHERE description ~ '{FRASE_FICTICIA}'"
    )
    op.execute("UPDATE places SET source = 'campo' WHERE source = 'ficticio'")
    op.execute("UPDATE businesses SET source = 'campo' WHERE source = 'ficticio'")


def downgrade() -> None:
    pass
