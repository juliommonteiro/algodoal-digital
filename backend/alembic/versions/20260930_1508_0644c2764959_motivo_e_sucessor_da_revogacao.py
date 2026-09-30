"""motivo e sucessor da revogação

refresh_tokens ganha:
- revoked_reason ('rotation' | 'logout' | 'reuse'): só a rotação reapresentada fora da janela
  de graça é tratada como vazamento; logout reapresentado é só 401.
- replaced_by_jti: o sucessor na rotação. É por ele que a janela de graça devolve o par que
  substituiu o token, e que uma cadeia de rotações pode ser seguida.

Revogações que já existem ficam como 'rotation': até aqui os motivos eram indistinguíveis, e
'rotation' mantém o comportamento anterior (reapresentar = reuso). Só bancos de dev têm linhas,
e todas já passaram da janela de 30 segundos.

Revision ID: 0644c2764959
Revises: 5966baf2fa25
Create Date: 2026-09-30 15:08:05.259837
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = '0644c2764959'
down_revision: str | None = '5966baf2fa25'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column('refresh_tokens', sa.Column('revoked_reason', sa.String(length=20), nullable=True))
    op.add_column('refresh_tokens', sa.Column('replaced_by_jti', sa.String(length=64), nullable=True))
    # Dados antes das restrições: toda revogação precisa ter motivo.
    op.execute(
        "UPDATE refresh_tokens SET revoked_reason = 'rotation' "
        "WHERE revoked_at IS NOT NULL AND revoked_reason IS NULL"
    )
    op.create_check_constraint(
        op.f('ck_refresh_tokens_revoked_reason_valido'),
        'refresh_tokens',
        "revoked_reason IN ('rotation', 'logout', 'reuse')",
    )
    op.create_check_constraint(
        op.f('ck_refresh_tokens_revogacao_com_motivo'),
        'refresh_tokens',
        "(revoked_at IS NULL) = (revoked_reason IS NULL)",
    )
    op.create_check_constraint(
        op.f('ck_refresh_tokens_sucessor_so_na_rotacao'),
        'refresh_tokens',
        "replaced_by_jti IS NULL OR revoked_reason = 'rotation'",
    )


def downgrade() -> None:
    op.drop_constraint(op.f('ck_refresh_tokens_sucessor_so_na_rotacao'), 'refresh_tokens', type_='check')
    op.drop_constraint(op.f('ck_refresh_tokens_revogacao_com_motivo'), 'refresh_tokens', type_='check')
    op.drop_constraint(op.f('ck_refresh_tokens_revoked_reason_valido'), 'refresh_tokens', type_='check')
    op.drop_column('refresh_tokens', 'replaced_by_jti')
    op.drop_column('refresh_tokens', 'revoked_reason')
