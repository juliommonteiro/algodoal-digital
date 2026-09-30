"""refresh tokens e services obrigatório

S5, autenticação:
- refresh_tokens: um registro por token de renovação emitido. Guardar o jti é o que permite
  revogar (logout, rotação) e detectar reuso de um token já revogado.

Débito da S4, na mesma migração:
- businesses.services deixa de aceitar NULL, que era uma segunda forma de dizer "sem serviços".
  Os NULLs existentes viram '[]' antes do NOT NULL (o autogenerate não faz isso, e o ALTER
  falharia em qualquer banco com um NULL); o DEFAULT '[]' também é escrito à mão, porque o
  env.py não compara server_default.
  Um CHECK exige que o valor seja uma lista JSON: o NOT NULL sozinho aceitaria o JSON 'null',
  que é o que o SQLAlchemy grava por padrão quando o código atribui None.

Revision ID: 5966baf2fa25
Revises: 67a9dd9c4314
Create Date: 2026-09-29 21:01:59.768606
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = '5966baf2fa25'
down_revision: str | None = '67a9dd9c4314'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table('refresh_tokens',
    sa.Column('jti', sa.String(length=64), nullable=False),
    sa.Column('user_id', sa.Uuid(), nullable=False),
    sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('revoked_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_refresh_tokens_user_id_users'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_refresh_tokens'))
    )
    op.create_index(op.f('ix_refresh_tokens_jti'), 'refresh_tokens', ['jti'], unique=True)
    op.create_index(op.f('ix_refresh_tokens_user_id'), 'refresh_tokens', ['user_id'], unique=False)

    # Ordem importa: dados primeiro, depois o default, depois as restrições.
    op.execute(
        "UPDATE businesses SET services = '[]'::jsonb "
        "WHERE services IS NULL OR jsonb_typeof(services) = 'null'"
    )
    op.alter_column('businesses', 'services',
               existing_type=postgresql.JSONB(astext_type=sa.Text()),
               server_default=sa.text("'[]'::jsonb"),
               nullable=False)
    op.create_check_constraint(
        op.f('ck_businesses_services_lista'), 'businesses', "jsonb_typeof(services) = 'array'"
    )


def downgrade() -> None:
    # A lista vazia continua lista vazia: não há como saber quais linhas eram NULL antes.
    # O esquema volta exatamente ao anterior (anulável, sem default e sem o CHECK).
    op.drop_constraint(op.f('ck_businesses_services_lista'), 'businesses', type_='check')
    op.alter_column('businesses', 'services',
               existing_type=postgresql.JSONB(astext_type=sa.Text()),
               server_default=None,
               nullable=True)
    op.drop_index(op.f('ix_refresh_tokens_user_id'), table_name='refresh_tokens')
    op.drop_index(op.f('ix_refresh_tokens_jti'), table_name='refresh_tokens')
    op.drop_table('refresh_tokens')
