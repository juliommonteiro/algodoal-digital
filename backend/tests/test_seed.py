import importlib.util
from datetime import UTC, datetime
from decimal import Decimal
from pathlib import Path

import pytest
from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import func, select

from app.models import Business, Carrier, Category, Place
from scripts.seed import seed
from tests.conftest import precisa_de_banco

pytestmark = [pytest.mark.db, precisa_de_banco]

VERSOES = Path(__file__).resolve().parents[1] / "alembic" / "versions"


def seed_categoria_praias(db) -> Category:
    categoria = Category(slug="praias", name="Praias", icon="waves")
    db.add(categoria)
    db.flush()
    return categoria


def rodar_migracao(db, slug: str) -> None:
    """Roda o upgrade() de uma migração na conexão do teste (some no ROLLBACK do fim)."""
    (arquivo,) = VERSOES.glob(f"*_{slug}.py")
    especificacao = importlib.util.spec_from_file_location(slug, arquivo)
    modulo = importlib.util.module_from_spec(especificacao)
    especificacao.loader.exec_module(modulo)
    with Operations.context(MigrationContext.configure(db.connection())):
        modulo.upgrade()


def test_seed_e_idempotente(db):
    primeira = seed(db)
    segunda = seed(db)

    assert primeira == segunda
    # Fotos de verdade entram pelos painéis (#29): o seed não cria nenhuma.
    assert all(total > 0 for tabela, total in primeira.items() if tabela != "place_photos")


def test_seed_insere_arvore_de_categorias_e_catalogo_inicial(db):
    seed(db)

    turismo = db.scalar(select(Category).where(Category.slug == "turismo"))
    praias = db.scalar(select(Category).where(Category.slug == "praias"))
    assert turismo is not None
    assert praias is not None
    assert praias.parent_id == turismo.id
    # Categoria é estrutura do diretório: não tem origem de dado.
    assert not hasattr(turismo, "source")

    # O catálogo inicial é dado da equipe, como o que entra pelo painel admin.
    locais = list(db.scalars(select(Place).where(Place.source == "campo")))
    assert len(locais) >= 12
    assert {local.kind for local in locais} >= {"beach", "trail", "business"}
    assert not [local.name for local in locais if "fictíci" in (local.description or "")]

    comercios = list(db.scalars(select(Business).where(Business.source == "campo")))
    assert len(comercios) >= 6
    assert all(c.place.kind == "business" for c in comercios)
    assert all(c.whatsapp is None or c.whatsapp.startswith("(91) 95555-") for c in comercios)

    carroceiros = list(db.scalars(select(Carrier)))
    assert len(carroceiros) >= 3
    assert all(c.user.email.endswith("@example.com") for c in carroceiros)


def test_seed_nao_mexe_no_catalogo_que_a_equipe_editou(db):
    seed(db)
    praia = db.scalar(select(Place).where(Place.name == "Praia do Cajueiro Torto"))
    praia.name = "Praia da Princesa"
    praia.description = "Descrição escrita pela equipe."
    praia.latitude, praia.longitude = Decimal("-0.581000"), Decimal("-47.575000")
    trilha = db.scalar(select(Place).where(Place.name == "Trilha do Vento Sul"))
    trilha.deleted_at = datetime.now(UTC)
    db.flush()
    total_antes = db.scalar(select(func.count()).select_from(Place))

    seed(db)
    db.refresh(praia)
    db.refresh(trilha)

    # Renomeado não volta com o nome antigo, editado não é sobrescrito, removido não volta.
    assert db.scalar(select(func.count()).select_from(Place)) == total_antes
    assert db.scalar(select(Place).where(Place.name == "Praia do Cajueiro Torto")) is None
    assert (praia.name, praia.description) == (
        "Praia da Princesa",
        "Descrição escrita pela equipe.",
    )
    assert (praia.latitude, praia.longitude) == (Decimal("-0.581000"), Decimal("-47.575000"))
    assert trilha.deleted_at is not None


def test_seed_nao_completa_catalogo_de_banco_que_ja_tem_local(db):
    categoria = seed_categoria_praias(db)
    db.add(
        Place(
            name="Praia cadastrada pelo painel",
            kind="beach",
            category_id=categoria.id,
            latitude=Decimal("-0.578260"),
            longitude=Decimal("-47.580330"),
            source="campo",
        )
    )
    db.flush()

    seed(db)

    assert db.scalar(select(func.count()).select_from(Place)) == 1
    assert db.scalar(select(func.count()).select_from(Business)) == 0


def test_migracao_tira_a_frase_ficticia_e_passa_o_catalogo_para_a_equipe(db):
    """Banco semeado antes da mudança: descrições com "… fictício." e source='ficticio'."""
    categoria = seed_categoria_praias(db)
    descricoes = {
        "Praia antiga": "Faixa de areia larga. Local fictício.",
        "Pousada antiga": "Dez quartos. Estabelecimento fictício.",
        "Passeio antigo": "Saída de canoa. Experiência fictícia.",
        "Editado pela equipe": "Texto que a equipe já reescreveu.",
        "Só a frase": "Local fictício.",
    }
    locais = {
        nome: Place(
            name=nome,
            kind="beach",
            category_id=categoria.id,
            latitude=Decimal("-0.578260"),
            longitude=Decimal("-47.580330"),
            description=descricao,
            source="ficticio",
        )
        for nome, descricao in descricoes.items()
    }
    do_painel = Place(
        name="Do painel",
        kind="beach",
        category_id=categoria.id,
        latitude=Decimal("-0.578260"),
        longitude=Decimal("-47.580330"),
        description="Ponto fictício é o apelido do lugar.",
        source="campo",
    )
    db.add_all([*locais.values(), do_painel])
    db.flush()
    db.add(Business(place_id=locais["Pousada antiga"].id, source="ficticio"))
    db.flush()

    rodar_migracao(db, "catalogo_inicial_vira_dado_da_equipe")
    db.expire_all()

    assert {nome: local.description for nome, local in locais.items()} == {
        "Praia antiga": "Faixa de areia larga.",
        "Pousada antiga": "Dez quartos.",
        "Passeio antigo": "Saída de canoa.",
        "Editado pela equipe": "Texto que a equipe já reescreveu.",
        "Só a frase": None,
    }
    assert {local.source for local in locais.values()} == {"campo"}
    assert locais["Pousada antiga"].business.source == "campo"
    # A frase só sai do fim: no meio do texto é conteúdo de quem escreveu.
    assert do_painel.description == "Ponto fictício é o apelido do lugar."


def test_migracao_tira_as_fotos_ficticias_e_renumera(db):
    from app.models import PlacePhoto

    categoria = seed_categoria_praias(db)
    local = Place(
        name="Com fotos",
        kind="beach",
        category_id=categoria.id,
        latitude=Decimal("-0.578260"),
        longitude=Decimal("-47.580330"),
        source="campo",
    )
    db.add(local)
    db.flush()
    db.add_all(
        [
            PlacePhoto(place_id=local.id, storage_key="ficticio/x.webp", position=0),
            PlacePhoto(place_id=local.id, storage_key="places/a.jpg", position=1),
            PlacePhoto(place_id=local.id, storage_key="places/b.jpg", position=2),
        ]
    )
    db.flush()

    rodar_migracao(db, "tira_as_fotos_ficticias")
    db.expire_all()

    fotos = sorted(local.photos, key=lambda f: f.position)
    assert [(f.storage_key, f.position) for f in fotos] == [
        ("places/a.jpg", 0),
        ("places/b.jpg", 1),
    ]


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


def test_conta_de_teste_de_carroceiro_tem_perfil_para_abrir_o_painel(db, api):
    from scripts.seed import SENHA_DE_TESTE

    seed(db)
    seed(db)  # idempotente: não cria um segundo perfil

    login = api.post(
        "/api/v1/auth/login", json={"email": "carroceiro@example.com", "password": SENHA_DE_TESTE}
    )
    token = login.json()["access_token"]
    perfil = api.get("/api/v1/carrier/me", headers={"Authorization": f"Bearer {token}"})
    assert perfil.status_code == 200
    assert perfil.json()["is_available"] is True


def test_conta_de_teste_de_parceiro_entra_e_abre_o_painel_vazio(db, api):
    from scripts.seed import SENHA_DE_TESTE

    seed(db)

    login = api.post(
        "/api/v1/auth/login", json={"email": "parceiro@example.com", "password": SENHA_DE_TESTE}
    )
    assert login.json()["user"]["role"] == "partner"
    token = login.json()["access_token"]
    painel = api.get("/api/v1/partner/places", headers={"Authorization": f"Bearer {token}"})
    assert painel.status_code == 200
