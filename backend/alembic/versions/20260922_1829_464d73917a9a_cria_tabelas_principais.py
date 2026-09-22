"""cria tabelas principais

Entidades da S4: users, categories, places, place_photos, businesses, carriers.
Campos de domínio fechado (role, kind, source) são String + CheckConstraint em vez de
enum nativo do Postgres, porque o autogenerate do Alembic não detecta valor novo em enum.
A função set_updated_at() e os triggers vêm na migração seguinte.

Revision ID: 464d73917a9a
Revises: 
Create Date: 2026-09-22 18:29:15.521840
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = '464d73917a9a'
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # categories vem primeiro: places depende dela. A FK auto-referente (parent_id) é
    # criada junto com a tabela, o Postgres resolve sem precisar de ALTER depois.
    op.create_table('categories',
    sa.Column('parent_id', sa.Uuid(), nullable=True),
    sa.Column('slug', sa.String(length=80), nullable=False),
    sa.Column('name', sa.String(length=120), nullable=False),
    sa.Column('icon', sa.String(length=60), nullable=True),
    sa.Column('sort_order', sa.Integer(), server_default='0', nullable=False),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['parent_id'], ['categories.id'], name=op.f('fk_categories_parent_id_categories'), ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_categories')),
    sa.UniqueConstraint('slug', name=op.f('uq_categories_slug'))
    )
    op.create_table('users',
    sa.Column('name', sa.String(length=120), nullable=False),
    sa.Column('email', sa.String(length=255), nullable=False),
    sa.Column('phone', sa.String(length=30), nullable=True),
    sa.Column('password_hash', sa.String(length=255), nullable=True),
    sa.Column('role', sa.String(length=20), server_default='tourist', nullable=False),
    sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint("role IN ('tourist', 'carrier', 'partner', 'admin')", name=op.f('ck_users_role_valido')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_users')),
    sa.UniqueConstraint('email', name=op.f('uq_users_email'))
    )
    op.create_table('carriers',
    sa.Column('user_id', sa.Uuid(), nullable=False),
    sa.Column('display_name', sa.String(length=120), nullable=False),
    sa.Column('whatsapp', sa.String(length=30), nullable=True),
    sa.Column('capacity', sa.Integer(), server_default='2', nullable=False),
    sa.Column('is_available', sa.Boolean(), server_default='false', nullable=False),
    sa.Column('is_approved', sa.Boolean(), server_default='false', nullable=False),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_carriers_user_id_users'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_carriers')),
    sa.UniqueConstraint('user_id', name=op.f('uq_carriers_user_id'))
    )
    op.create_index('ix_carriers_is_available', 'carriers', ['is_available'], unique=False)
    op.create_table('places',
    sa.Column('category_id', sa.Uuid(), nullable=False),
    sa.Column('kind', sa.String(length=30), nullable=False),
    sa.Column('name', sa.String(length=160), nullable=False),
    sa.Column('description', sa.Text(), nullable=True),
    sa.Column('latitude', sa.Numeric(precision=9, scale=6), nullable=False),
    sa.Column('longitude', sa.Numeric(precision=9, scale=6), nullable=False),
    sa.Column('is_published', sa.Boolean(), server_default='true', nullable=False),
    sa.Column('source', sa.String(length=20), server_default='ficticio', nullable=False),
    sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint("kind IN ('beach', 'trail', 'tourist_point', 'experience', 'business', 'collection_point', 'culture')", name=op.f('ck_places_kind_valido')),
    sa.CheckConstraint("source IN ('ficticio', 'campo', 'osm')", name=op.f('ck_places_source_valido')),
    sa.ForeignKeyConstraint(['category_id'], ['categories.id'], name=op.f('fk_places_category_id_categories'), ondelete='RESTRICT'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_places'))
    )
    op.create_index('ix_places_category_id', 'places', ['category_id'], unique=False)
    op.create_index('ix_places_kind', 'places', ['kind'], unique=False)
    op.create_index('ix_places_updated_at', 'places', ['updated_at'], unique=False)
    op.create_table('businesses',
    sa.Column('place_id', sa.Uuid(), nullable=False),
    sa.Column('owner_id', sa.Uuid(), nullable=True),
    sa.Column('whatsapp', sa.String(length=30), nullable=True),
    sa.Column('phone', sa.String(length=30), nullable=True),
    sa.Column('opening_hours', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('price_range', sa.String(length=10), nullable=True),
    sa.Column('services', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('is_partner', sa.Boolean(), server_default='false', nullable=False),
    sa.Column('source', sa.String(length=20), server_default='ficticio', nullable=False),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint("source IN ('ficticio', 'campo', 'osm')", name=op.f('ck_businesses_source_valido')),
    sa.ForeignKeyConstraint(['owner_id'], ['users.id'], name=op.f('fk_businesses_owner_id_users'), ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['place_id'], ['places.id'], name=op.f('fk_businesses_place_id_places'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_businesses'))
    )
    op.create_index(op.f('ix_businesses_place_id'), 'businesses', ['place_id'], unique=True)
    op.create_table('place_photos',
    sa.Column('place_id', sa.Uuid(), nullable=False),
    sa.Column('storage_key', sa.String(length=255), nullable=False),
    sa.Column('position', sa.Integer(), server_default='0', nullable=False),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['place_id'], ['places.id'], name=op.f('fk_place_photos_place_id_places'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_place_photos'))
    )
    op.create_index(op.f('ix_place_photos_place_id'), 'place_photos', ['place_id'], unique=False)


def downgrade() -> None:
    # Ordem inversa da criação, respeitando as FKs.
    op.drop_index(op.f('ix_place_photos_place_id'), table_name='place_photos')
    op.drop_table('place_photos')
    op.drop_index(op.f('ix_businesses_place_id'), table_name='businesses')
    op.drop_table('businesses')
    op.drop_index('ix_places_updated_at', table_name='places')
    op.drop_index('ix_places_kind', table_name='places')
    op.drop_index('ix_places_category_id', table_name='places')
    op.drop_table('places')
    op.drop_index('ix_carriers_is_available', table_name='carriers')
    op.drop_table('carriers')
    op.drop_table('users')
    op.drop_table('categories')
