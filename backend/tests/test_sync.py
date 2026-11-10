"""Pull do catálogo (#28): GET /sync/catalog, inteiro ou só o que mudou desde `since`."""

import uuid
from datetime import UTC, datetime, timedelta
from decimal import Decimal

import pytest
from sqlalchemy import text

from app.models import Business, Category, Place, PlacePhoto
from tests.conftest import precisa_de_banco

pytestmark = [pytest.mark.db, precisa_de_banco]

SYNC = "/api/v1/sync/catalog"


@pytest.fixture
def categoria(db) -> Category:
    c = Category(slug=f"sync-{uuid.uuid4().hex[:8]}", name="Praias")
    db.add(c)
    db.flush()
    return c


def _local(db, categoria, nome: str, **extra) -> Place:
    local = Place(
        name=nome,
        kind="business",
        category_id=categoria.id,
        latitude=Decimal("-0.590000"),
        longitude=Decimal("-47.586000"),
        **extra,
    )
    db.add(local)
    db.flush()
    return local


def envelhecer(db, *locais: Place, dias: int = 2) -> None:
    """Põe o updated_at no passado. O trigger de places regrava o updated_at em todo UPDATE,
    então ele fica desligado só nesta transação (o ROLLBACK do teste desfaz o ALTER)."""
    db.execute(text("ALTER TABLE places DISABLE TRIGGER trg_places_set_updated_at"))
    db.execute(
        text(
            "UPDATE places SET updated_at = now() - make_interval(days => :dias) "
            "WHERE id = ANY(:ids)"
        ),
        {"dias": dias, "ids": [local.id for local in locais]},
    )
    db.execute(text("ALTER TABLE places ENABLE TRIGGER trg_places_set_updated_at"))
    db.expire_all()


def ontem() -> str:
    return (datetime.now(UTC) - timedelta(days=1)).isoformat()


def nomes(corpo) -> set[str]:
    return {p["name"] for p in corpo["places"]}


def test_sem_since_vem_o_catalogo_publico_inteiro(db, api, categoria):
    _local(db, categoria, "Publicado")
    _local(db, categoria, "Rascunho", is_published=False)
    _local(db, categoria, "Removido", deleted_at=datetime.now(UTC))

    corpo = api.get(SYNC).json()

    assert corpo["full"] is True
    assert "Publicado" in nomes(corpo)
    assert not {"Rascunho", "Removido"} & nomes(corpo)
    assert corpo["removed_place_ids"] == []
    assert any(c["id"] == str(categoria.id) for c in corpo["categories"])
    assert datetime.fromisoformat(corpo["server_time"])


def test_com_since_vem_so_o_que_mudou(db, api, categoria):
    antigo = _local(db, categoria, "Antigo")
    _local(db, categoria, "Novo")
    envelhecer(db, antigo)

    corpo = api.get(SYNC, params={"since": ontem()}).json()

    assert corpo["full"] is False
    assert "Novo" in nomes(corpo)
    assert "Antigo" not in nomes(corpo)


def test_mudar_so_o_negocio_marca_o_local(db, api, categoria):
    local = _local(db, categoria, "Restaurante")
    db.add(Business(place_id=local.id, source="campo"))
    db.flush()
    envelhecer(db, local)
    assert "Restaurante" not in nomes(api.get(SYNC, params={"since": ontem()}).json())

    negocio = db.get(Place, local.id).business
    negocio.opening_hours = {"seg": [["09:00", "18:00"]]}
    db.flush()

    assert "Restaurante" in nomes(api.get(SYNC, params={"since": ontem()}).json())


@pytest.mark.parametrize("acao", ["incluir", "apagar"])
def test_mexer_numa_foto_marca_o_local(db, api, categoria, acao):
    local = _local(db, categoria, "Pousada")
    foto = PlacePhoto(place_id=local.id, storage_key="places/x.jpg", position=0)
    db.add(foto)
    db.flush()
    envelhecer(db, local)

    if acao == "incluir":
        db.add(PlacePhoto(place_id=local.id, storage_key="places/y.jpg", position=1))
    else:
        db.delete(db.get(PlacePhoto, foto.id))
    db.flush()

    assert "Pousada" in nomes(api.get(SYNC, params={"since": ontem()}).json())


def test_despublicado_e_removido_vao_na_lista_de_saidos(db, api, categoria):
    rascunho = _local(db, categoria, "Virou rascunho")
    removido = _local(db, categoria, "Foi removido")
    envelhecer(db, rascunho, removido)

    db.get(Place, rascunho.id).is_published = False
    db.get(Place, removido.id).deleted_at = datetime.now(UTC)
    db.flush()
    corpo = api.get(SYNC, params={"since": ontem()}).json()

    assert set(corpo["removed_place_ids"]) >= {str(rascunho.id), str(removido.id)}
    assert not {"Virou rascunho", "Foi removido"} & nomes(corpo)


def test_saido_ha_muito_tempo_nao_volta_na_lista(db, api, categoria):
    velho = _local(db, categoria, "Removido há tempo", deleted_at=datetime.now(UTC))
    envelhecer(db, velho, dias=30)

    corpo = api.get(SYNC, params={"since": ontem()}).json()

    assert str(velho.id) not in corpo["removed_place_ids"]


def test_republicado_volta_nos_locais(db, api, categoria):
    local = _local(db, categoria, "Voltou", is_published=False)
    envelhecer(db, local)

    db.get(Place, local.id).is_published = True
    db.flush()
    corpo = api.get(SYNC, params={"since": ontem()}).json()

    assert "Voltou" in nomes(corpo)
    assert str(local.id) not in corpo["removed_place_ids"]


def test_margem_de_um_minuto_antes_do_since(db, api, categoria):
    """Gravação que terminou junto com a consulta anterior não pode se perder."""
    _local(db, categoria, "Na beirada")
    # O local foi gravado agora; o since é 30 s depois: dentro da margem, ele ainda vem.
    since = (datetime.now(UTC) + timedelta(seconds=30)).isoformat()

    assert "Na beirada" in nomes(api.get(SYNC, params={"since": since}).json())


def test_since_invalido_e_422(api):
    assert api.get(SYNC, params={"since": "ontem"}).status_code == 422
