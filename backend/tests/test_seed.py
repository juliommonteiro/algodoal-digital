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


def test_seed_recusa_rodar_em_producao_antes_de_escrever(db, monkeypatch):
    from sqlalchemy import func

    from app.core.config import get_settings
    from app.models import User
    from scripts.seed import SeedEmProducao

    antes = db.scalar(select(func.count()).select_from(User))
    monkeypatch.setattr(get_settings(), "environment", "production")

    with pytest.raises(SeedEmProducao, match="ENVIRONMENT=production"):
        seed(db)

    assert db.scalar(select(func.count()).select_from(User)) == antes


def test_seed_pela_linha_de_comando_em_producao_sai_com_erro(monkeypatch, capsys):
    from app.core.config import get_settings
    from scripts import seed as modulo

    monkeypatch.setattr(get_settings(), "environment", "production")
    monkeypatch.setattr("sys.argv", ["seed"])
    abriu_sessao = []
    monkeypatch.setattr(modulo, "SessionLocal", lambda: abriu_sessao.append(1))

    with pytest.raises(SystemExit) as saida:
        modulo.main()

    assert saida.value.code == 1
    assert "contas de teste" in capsys.readouterr().err
    assert abriu_sessao == []  # nem chegou a abrir o banco


def test_contas_de_teste_entram_e_os_ficticios_nao(db, api):
    from scripts.seed import CONTAS_DE_TESTE, SENHA_DE_TESTE

    seed(db)

    for conta in CONTAS_DE_TESTE:
        resposta = api.post(
            "/api/v1/auth/login", json={"email": conta["email"], "password": SENHA_DE_TESTE}
        )
        assert resposta.status_code == 200, conta["email"]
        assert resposta.json()["user"]["role"] == conta["role"]
    ficticio = api.post(
        "/api/v1/auth/login", json={"email": "davi.admin@example.com", "password": SENHA_DE_TESTE}
    )
    assert ficticio.status_code == 401
