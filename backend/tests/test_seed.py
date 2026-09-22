import pytest
from sqlalchemy import select

from app.models import Business, Carrier, Category, Place
from scripts.seed import seed
from tests.conftest import precisa_de_banco

pytestmark = [pytest.mark.db, precisa_de_banco]


def test_seed_e_idempotente(db):
    primeira = seed(db)
    segunda = seed(db)

    assert primeira == segunda
    assert all(total > 0 for total in primeira.values())


def test_seed_insere_arvore_de_categorias_e_dados_ficticios(db):
    seed(db)

    turismo = db.scalar(select(Category).where(Category.slug == "turismo"))
    praias = db.scalar(select(Category).where(Category.slug == "praias"))
    assert turismo is not None
    assert praias is not None
    assert praias.parent_id == turismo.id
    # Categoria é estrutura real do diretório, não dado de demonstração.
    assert not hasattr(turismo, "source")

    locais = list(db.scalars(select(Place).where(Place.source == "ficticio")))
    assert len(locais) >= 12
    assert {local.kind for local in locais} >= {"beach", "trail", "business"}

    comercios = list(db.scalars(select(Business).where(Business.source == "ficticio")))
    assert len(comercios) >= 6
    assert all(c.place.kind == "business" for c in comercios)
    assert all(c.whatsapp is None or c.whatsapp.startswith("(91) 95555-") for c in comercios)

    carroceiros = list(db.scalars(select(Carrier)))
    assert len(carroceiros) >= 3
    assert all(c.user.email.endswith("@example.com") for c in carroceiros)


def test_seed_com_reset_nao_duplica(db):
    antes = seed(db)
    depois = seed(db, reset=True)

    assert antes == depois
