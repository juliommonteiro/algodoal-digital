import uuid
from datetime import UTC, datetime
from decimal import Decimal

import pytest
from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError

from app.models import Category, Place, User
from tests.conftest import precisa_de_banco

pytestmark = [pytest.mark.db, precisa_de_banco]


def _email_unico() -> str:
    return f"teste-{uuid.uuid4().hex[:12]}@example.com"


def _slug_unico() -> str:
    return f"slug-teste-{uuid.uuid4().hex[:12]}"


def test_cria_e_le_usuario(db):
    email = _email_unico()
    db.add(User(name="Ana Viajante", email=email, phone="(91) 95555-0201"))
    db.flush()

    lido = db.scalar(select(User).where(User.email == email))
    assert lido is not None
    assert lido.name == "Ana Viajante"
    assert lido.role == "tourist"  # default
    assert lido.is_active is True
    assert lido.password_hash is None  # hash de senha é da S5
    assert isinstance(lido.id, uuid.UUID)
    assert lido.created_at is not None


def test_email_duplicado_levanta_integrity_error(db):
    email = _email_unico()
    db.add(User(name="Primeira", email=email))
    db.flush()

    db.add(User(name="Segunda", email=email))
    with pytest.raises(IntegrityError):
        db.flush()


def test_role_invalido_e_rejeitado_pelo_check_constraint(db):
    db.add(User(name="Perfil Inválido", email=_email_unico(), role="prefeito"))
    with pytest.raises(IntegrityError) as erro:
        db.flush()
    assert "ck_users_role_valido" in str(erro.value)


def test_cria_e_le_place_com_categoria(db):
    categoria = Category(slug=_slug_unico(), name="Praias de teste")
    db.add(categoria)
    db.flush()

    local = Place(
        name="Praia do Cajueiro Torto (teste)",
        kind="beach",
        category_id=categoria.id,
        latitude=Decimal("-0.585200"),
        longitude=Decimal("-47.561400"),
        description="Local fictício usado só no teste.",
    )
    db.add(local)
    db.flush()
    db.expire(local)

    lido = db.scalar(select(Place).where(Place.id == local.id))
    assert lido is not None
    assert lido.category.slug == categoria.slug
    assert lido.latitude == Decimal("-0.585200")
    assert lido.source == "ficticio"
    assert lido.is_published is True
    assert lido.deleted_at is None


def test_kind_invalido_e_rejeitado_pelo_check_constraint(db):
    categoria = Category(slug=_slug_unico(), name="Categoria de teste")
    db.add(categoria)
    db.flush()

    db.add(
        Place(
            name="Lugar de tipo inexistente",
            kind="submarino",
            category_id=categoria.id,
            latitude=Decimal("-0.600000"),
            longitude=Decimal("-47.570000"),
        )
    )
    with pytest.raises(IntegrityError) as erro:
        db.flush()
    assert "ck_places_kind_valido" in str(erro.value)


def test_trigger_atualiza_updated_at(db):
    """UPDATE feito direto no banco (sem ORM) precisa mexer em updated_at."""
    usuario = User(name="Antes", email=_email_unico())
    db.add(usuario)
    db.flush()
    antes = db.scalar(select(User.updated_at).where(User.id == usuario.id))

    # Sem passar pelo ORM: quem tem de preencher updated_at é o trigger.
    db.execute(
        text("UPDATE users SET name = :nome WHERE id = :id"),
        {"nome": "Depois", "id": usuario.id},
    )
    depois = db.scalar(select(User.updated_at).where(User.id == usuario.id))

    assert depois > antes
    assert depois > datetime(2020, 1, 1, tzinfo=UTC)


def test_hierarquia_de_categorias(db):
    mae = Category(slug=_slug_unico(), name="Turismo (teste)")
    db.add(mae)
    db.flush()

    filha = Category(slug=_slug_unico(), name="Praias (teste)", parent_id=mae.id)
    db.add(filha)
    db.flush()
    db.expire(mae)

    assert filha.parent is not None
    assert filha.parent.id == mae.id
    assert [c.id for c in mae.children] == [filha.id]
