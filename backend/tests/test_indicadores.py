"""Indicadores do piloto no painel admin (#40). Os testes comparam antes e depois: o banco de
teste pode ter linhas de outros cenários."""

import uuid
from datetime import UTC, datetime, timedelta
from decimal import Decimal

import pytest
from sqlalchemy import text

from app.models import Business, Carrier, Category, Place, PlacePhoto, RideRequest
from app.schemas.auth import CarroceiroIn
from app.services import auth as servico_auth
from tests.conftest import precisa_de_banco

pytestmark = [pytest.mark.db, precisa_de_banco]

INDICADORES = "/api/v1/admin/indicators"


def _conta(db, role="tourist", carroceiro=None):
    email = f"{role}-{uuid.uuid4().hex[:8]}@example.com"
    par = servico_auth.registrar(
        db, nome="Conta", email=email, senha="senha-segura-1", carroceiro=carroceiro
    )
    if carroceiro is None:
        par.user.role = role
    db.commit()
    return par.user, {"Authorization": f"Bearer {par.access_token}"}


@pytest.fixture
def admin(db):
    return _conta(db, "admin")[1]


def ler(api, admin) -> dict:
    resposta = api.get(INDICADORES, headers=admin)
    assert resposta.status_code == 200, resposta.text
    return resposta.json()


def diferenca(antes: dict, depois: dict, grupo: str) -> dict:
    return {
        chave: depois[grupo][chave] - antes[grupo][chave]
        for chave in antes[grupo]
        if isinstance(antes[grupo][chave], int)
    }


def test_usuarios_por_perfil_e_ativos(db, api, admin):
    antes = ler(api, admin)
    _conta(db, "tourist")
    _conta(db, "partner")
    _conta(db, carroceiro=CarroceiroIn(whatsapp="(91) 98888-0001"))

    mudou = diferenca(antes, ler(api, admin), "usuarios")

    assert mudou == {
        "total": 3,
        "ativos_30_dias": 3,  # quem se cadastra já abre sessão
        "turistas": 1,
        "carroceiros": 1,
        "parceiros": 1,
        "admins": 0,
    }


def test_locais_estabelecimentos_dono_e_foto(db, api, admin):
    antes = ler(api, admin)
    categoria = Category(slug=f"ind-{uuid.uuid4().hex[:8]}", name="Restaurantes")
    db.add(categoria)
    db.flush()
    dono, _ = _conta(db, "partner")
    antes = ler(api, admin)

    def local(**extra):
        p = Place(
            name="L",
            kind="business",
            category_id=categoria.id,
            latitude=Decimal("-0.59"),
            longitude=Decimal("-47.58"),
            **extra,
        )
        db.add(p)
        db.flush()
        return p

    com_dono = local()
    db.add(Business(place_id=com_dono.id, owner_id=dono.id, source="campo"))
    db.add(PlacePhoto(place_id=com_dono.id, storage_key="places/a.jpg", position=0))
    db.add(PlacePhoto(place_id=com_dono.id, storage_key="places/b.jpg", position=1))
    sem_dono = local(is_published=False)
    db.add(Business(place_id=sem_dono.id, source="campo"))
    removido = local(deleted_at=datetime.now(UTC))
    db.add(Business(place_id=removido.id, owner_id=dono.id, source="campo"))
    db.flush()

    mudou = diferenca(antes, ler(api, admin), "locais")

    assert mudou == {
        "publicados": 1,
        "rascunhos": 1,
        "removidos": 1,
        "estabelecimentos": 2,  # o removido não conta
        "estabelecimentos_com_dono": 1,
        "com_foto": 1,  # locais com foto, não fotos
    }


def test_carroceiros_aprovados_e_disponiveis(db, api, admin):
    antes = ler(api, admin)
    _conta(db, carroceiro=CarroceiroIn(whatsapp="(91) 98888-0001"))
    indisponivel, _ = _conta(db, carroceiro=CarroceiroIn(whatsapp="(91) 98888-0002"))
    db.get(Carrier, indisponivel.carrier.id).is_available = False
    db.flush()

    assert diferenca(antes, ler(api, admin), "carroceiros") == {"total": 2, "disponiveis": 1}


def test_pedidos_taxa_de_aceite_e_tempo_ate_aceite(db, api, admin):
    turista, _ = _conta(db, "tourist")
    carroceiro, _ = _conta(db, carroceiro=CarroceiroIn(whatsapp="(91) 98888-0001"))
    antes = ler(api, admin)
    agora = datetime.now(UTC)

    def pedido(status, criado=agora, aceito_em=None):
        p = RideRequest(
            tourist_id=turista.id,
            origin="Vila",
            destination="Princesa",
            passengers=2,
            tourist_whatsapp="(91) 97777-1111",
            status=status,
            carrier_id=carroceiro.carrier.id if status == "accepted" else None,
            responded_at=aceito_em,
        )
        db.add(p)
        db.flush()
        db.execute(
            text("UPDATE ride_requests SET created_at = :c WHERE id = :i"), {"c": criado, "i": p.id}
        )
        return p

    pedido("accepted", agora - timedelta(minutes=10), aceito_em=agora - timedelta(minutes=8))
    pedido("accepted", agora - timedelta(minutes=10), aceito_em=agora - timedelta(minutes=6))
    pedido("expired", agora - timedelta(hours=1))
    pedido("cancelled")
    pedido(
        "accepted", agora - timedelta(days=9), aceito_em=agora - timedelta(days=9)
    )  # fora da semana
    depois = ler(api, admin)

    assert diferenca(antes, depois, "pedidos") == {
        "total": 5,
        "ultimos_7_dias": 4,
        "aceitos_7_dias": 2,
    }
    if antes["pedidos"]["ultimos_7_dias"] == 0:  # sem pedidos de outros cenários na semana
        assert depois["pedidos"]["taxa_de_aceite_7_dias"] == pytest.approx(2 / 3, abs=0.001)
        assert depois["pedidos"]["minutos_ate_aceite_7_dias"] == pytest.approx(3.0)


def test_pedidos_de_hoje_com_status_atualizado(db, api, admin):
    turista, _ = _conta(db, "tourist")
    db.add(
        RideRequest(
            tourist_id=turista.id,
            origin="Trapiche",
            destination="Pousada",
            passengers=1,
            tourist_whatsapp="(91) 97777-1111",
        )
    )
    velho = RideRequest(
        tourist_id=turista.id,
        origin="Ontem",
        destination="Praia",
        passengers=1,
        tourist_whatsapp="(91) 97777-1111",
    )
    db.add(velho)
    db.flush()
    db.execute(
        text("UPDATE ride_requests SET created_at = now() - interval '2 days' WHERE id = :i"),
        {"i": velho.id},
    )

    de_hoje = ler(api, admin)["pedidos_de_hoje"]

    assert "Trapiche" in [p["origin"] for p in de_hoje]
    assert "Ontem" not in [p["origin"] for p in de_hoje]
    assert next(p for p in de_hoje if p["origin"] == "Trapiche")["status"] == "pending"


def test_indicadores_sao_so_do_admin(db, api):
    _, turista = _conta(db, "tourist")

    assert api.get(INDICADORES).status_code == 401
    assert api.get(INDICADORES, headers=turista).status_code == 403
