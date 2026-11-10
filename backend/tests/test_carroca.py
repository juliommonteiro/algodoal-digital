"""Pedido de carroça (#32 e #33): turista pede, carroceiros disponíveis veem, o primeiro que
aceitar leva."""

import uuid
from datetime import timedelta

import pytest
from sqlalchemy import select, update

from app.models import Carrier, RideRequest
from app.schemas.auth import CarroceiroIn
from app.services import auth as servico_auth
from app.services.carroca import VALIDADE
from tests.conftest import precisa_de_banco

pytestmark = [pytest.mark.db, precisa_de_banco]

SENHA = "senha-segura-1"
PEDIDO = {
    "origin": "Vila de Algodoal — orla",
    "destination": "Praia da Princesa",
    "passengers": 3,
    "notes": "Agora · duas malas grandes",
    "whatsapp": "(91) 97777-1111",
}


def _conta(db, nome: str, carroceiro: CarroceiroIn | None = None) -> dict[str, str]:
    email = f"{nome.lower()}-{uuid.uuid4().hex[:8]}@example.com"
    par = servico_auth.registrar(db, nome=nome, email=email, senha=SENHA, carroceiro=carroceiro)
    return {"Authorization": f"Bearer {par.access_token}"}


@pytest.fixture
def turista(db):
    return _conta(db, "Ana")


@pytest.fixture
def bento(db):
    return _conta(db, "Bento", CarroceiroIn(whatsapp="(91) 98888-0001", capacity=4))


@pytest.fixture
def rosa(db):
    return _conta(db, "Rosa", CarroceiroIn(whatsapp="(91) 98888-0002", capacity=6))


def pedir(api, quem, **mudancas):
    return api.post("/api/v1/ride-requests", json={**PEDIDO, **mudancas}, headers=quem)


def abertos(api, quem) -> list[dict]:
    resposta = api.get("/api/v1/carrier/requests", headers=quem)
    assert resposta.status_code == 200, resposta.text
    return resposta.json()


def atual(api, quem):
    return api.get("/api/v1/ride-requests/current", headers=quem)


def aceitar(api, quem, pedido_id: str):
    return api.post(f"/api/v1/carrier/requests/{pedido_id}/accept", headers=quem)


# ---------------------------------------------------------------------------------- pedir


def test_turista_pede_e_o_pedido_fica_pendente_por_dez_minutos(api, turista):
    resposta = pedir(api, turista)

    assert resposta.status_code == 201, resposta.text
    corpo = resposta.json()
    assert corpo["status"] == "pending"
    assert corpo["carrier"] is None
    assert (corpo["origin"], corpo["destination"], corpo["passengers"]) == (
        "Vila de Algodoal — orla",
        "Praia da Princesa",
        3,
    )
    assert "whatsapp" not in corpo  # o turista já sabe o próprio número
    assert atual(api, turista).json()["id"] == corpo["id"]


def test_sem_pedido_recente_o_atual_e_204(api, turista):
    assert atual(api, turista).status_code == 204


def test_nao_pede_de_novo_com_um_pedido_aguardando(api, turista):
    assert pedir(api, turista).status_code == 201

    segundo = pedir(api, turista)

    assert segundo.status_code == 409
    assert "Cancele" in segundo.json()["detail"]


@pytest.mark.parametrize(
    ("mudanca", "campo"),
    [
        ({"whatsapp": "98888-7777"}, "whatsapp"),
        ({"passengers": 0}, "passengers"),
        ({"passengers": 13}, "passengers"),
        ({"origin": "   "}, "origin"),
        ({"destination": ""}, "destination"),
        ({"notes": "x" * 301}, "notes"),
    ],
)
def test_pedido_invalido_devolve_422_no_campo(api, turista, mudanca, campo):
    resposta = pedir(api, turista, **mudanca)

    assert resposta.status_code == 422
    assert resposta.json()["detail"][0]["loc"] == ["body", campo]


def test_status_e_carroceiro_nao_vem_do_cliente(api, turista):
    resposta = pedir(api, turista, status="accepted")

    assert resposta.status_code == 422


def test_pedir_exige_sessao(api):
    assert api.post("/api/v1/ride-requests", json=PEDIDO).status_code == 401


# ------------------------------------------------------------------------- carroceiro vê


def test_carroceiro_disponivel_ve_o_pedido_sem_o_whatsapp_do_turista(api, turista, bento):
    pedido = pedir(api, turista).json()

    (visto,) = abertos(api, bento)

    assert visto["id"] == pedido["id"]
    assert visto["tourist_name"] == "Ana"
    assert visto["notes"] == "Agora · duas malas grandes"
    assert visto["tourist_whatsapp"] is None


def test_pedido_maior_que_a_carroca_nao_aparece_para_quem_nao_cabe(api, turista, bento, rosa):
    pedir(api, turista, passengers=5)  # Bento leva 4, Rosa leva 6

    assert abertos(api, bento) == []
    assert len(abertos(api, rosa)) == 1


def test_carroceiro_indisponivel_nao_recebe_pedidos_nem_aceita(api, turista, bento):
    pedido = pedir(api, turista).json()
    api.patch("/api/v1/carrier/me", json={"is_available": False}, headers=bento)

    assert abertos(api, bento) == []
    recusa = aceitar(api, bento, pedido["id"])
    assert recusa.status_code == 409
    assert recusa.json()["detail"] == "Fique disponível para aceitar pedidos."


# ------------------------------------------------------------------------------- aceitar


def test_aceitar_mostra_um_o_contato_do_outro(api, turista, bento):
    pedido = pedir(api, turista).json()

    aceito = aceitar(api, bento, pedido["id"])

    assert aceito.status_code == 200, aceito.text
    assert aceito.json()["status"] == "accepted"
    assert aceito.json()["tourist_whatsapp"] == "(91) 97777-1111"
    do_turista = atual(api, turista).json()
    assert do_turista["status"] == "accepted"
    assert do_turista["carrier"] == {"display_name": "Bento", "whatsapp": "(91) 98888-0001"}
    assert do_turista["responded_at"] is not None


def test_o_primeiro_que_aceita_leva(api, turista, bento, rosa):
    pedido = pedir(api, turista).json()
    assert aceitar(api, bento, pedido["id"]).status_code == 200

    tarde = aceitar(api, rosa, pedido["id"])

    assert tarde.status_code == 409
    assert "outro carroceiro aceitou" in tarde.json()["detail"]
    assert abertos(api, rosa) == []
    assert atual(api, turista).json()["carrier"]["display_name"] == "Bento"


def test_nao_aceita_pedido_maior_que_a_carroca(api, turista, bento):
    pedido = pedir(api, turista, passengers=5).json()

    resposta = aceitar(api, bento, pedido["id"])

    assert resposta.status_code == 409
    assert "mais passageiros" in resposta.json()["detail"]


def test_aceitar_pedido_inexistente_e_404(api, bento):
    assert aceitar(api, bento, str(uuid.uuid4())).status_code == 404


def test_depois_do_aceite_o_turista_pode_pedir_outra(api, turista, bento):
    pedido = pedir(api, turista).json()
    aceitar(api, bento, pedido["id"])

    assert pedir(api, turista).status_code == 201


# ------------------------------------------------------------------------------- recusar


def test_recusar_tira_o_pedido_so_da_lista_de_quem_recusou(api, turista, bento, rosa):
    pedido = pedir(api, turista).json()

    resposta = api.post(f"/api/v1/carrier/requests/{pedido['id']}/decline", headers=bento)

    assert resposta.status_code == 204
    assert abertos(api, bento) == []
    assert [p["id"] for p in abertos(api, rosa)] == [pedido["id"]]
    assert atual(api, turista).json()["status"] == "pending"
    # Recusar de novo não quebra, e quem recusou ainda pode mudar de ideia até alguém aceitar.
    assert (
        api.post(f"/api/v1/carrier/requests/{pedido['id']}/decline", headers=bento).status_code
        == 204
    )
    assert aceitar(api, rosa, pedido["id"]).status_code == 200


# ------------------------------------------------------------------------------ vencimento


def test_pedido_vence_em_dez_minutos_sem_ninguem_aceitar(db, api, turista, bento):
    pedido = pedir(api, turista).json()
    db.execute(
        update(RideRequest)
        .where(RideRequest.id == uuid.UUID(pedido["id"]))
        .values(created_at=RideRequest.created_at - VALIDADE - timedelta(seconds=1))
    )
    db.flush()

    assert abertos(api, bento) == []
    assert aceitar(api, bento, pedido["id"]).status_code == 409
    assert atual(api, turista).json()["status"] == "expired"
    # Vencido não prende o turista: ele pode pedir de novo.
    assert pedir(api, turista).status_code == 201


# ------------------------------------------------------------------------------- cancelar


def test_cancelar_pendente_tira_da_lista_e_volta_ao_formulario(api, turista, bento):
    pedido = pedir(api, turista).json()

    cancelado = api.post(f"/api/v1/ride-requests/{pedido['id']}/cancel", headers=turista)

    assert cancelado.status_code == 200
    assert cancelado.json()["status"] == "cancelled"
    assert abertos(api, bento) == []
    assert atual(api, turista).status_code == 204
    de_novo = api.post(f"/api/v1/ride-requests/{pedido['id']}/cancel", headers=turista)
    assert de_novo.status_code == 409


def test_cancelar_depois_do_aceite_fica_no_historico_do_carroceiro(api, turista, bento):
    pedido = pedir(api, turista).json()
    aceitar(api, bento, pedido["id"])

    api.post(f"/api/v1/ride-requests/{pedido['id']}/cancel", headers=turista)

    (viagem,) = api.get("/api/v1/carrier/rides", headers=bento).json()
    assert viagem["status"] == "cancelled"
    assert viagem["tourist_whatsapp"] is None  # cancelada, o contato sai


def test_nao_cancela_pedido_de_outra_pessoa(db, api, turista):
    pedido = pedir(api, turista).json()
    outra = _conta(db, "Outra")

    resposta = api.post(f"/api/v1/ride-requests/{pedido['id']}/cancel", headers=outra)

    assert resposta.status_code == 404


# ------------------------------------------------------------------- painel e permissões


def test_historico_tem_as_viagens_aceitas(api, turista, bento):
    pedido = pedir(api, turista).json()
    aceitar(api, bento, pedido["id"])

    (viagem,) = api.get("/api/v1/carrier/rides", headers=bento).json()

    assert viagem["id"] == pedido["id"]
    assert viagem["tourist_whatsapp"] == "(91) 97777-1111"


def test_carroceiro_ve_e_muda_o_proprio_perfil(api, bento):
    assert api.get("/api/v1/carrier/me", headers=bento).json() == {
        "display_name": "Bento",
        "whatsapp": "(91) 98888-0001",
        "capacity": 4,
        "is_available": True,
        "is_approved": True,
    }

    mudou = api.patch(
        "/api/v1/carrier/me", json={"is_available": False, "capacity": 5}, headers=bento
    )

    assert mudou.status_code == 200
    assert (mudou.json()["is_available"], mudou.json()["capacity"]) == (False, 5)


def test_carroceiro_nao_se_aprova_nem_se_desaprova(db, api, bento):
    resposta = api.patch("/api/v1/carrier/me", json={"is_approved": False}, headers=bento)

    assert resposta.status_code == 422
    assert db.scalar(select(Carrier.is_approved).where(Carrier.display_name == "Bento")) is True


@pytest.mark.parametrize(
    ("metodo", "caminho"),
    [
        ("get", "/api/v1/carrier/me"),
        ("get", "/api/v1/carrier/requests"),
        ("get", "/api/v1/carrier/rides"),
        ("post", f"/api/v1/carrier/requests/{uuid.uuid4()}/accept"),
    ],
)
def test_painel_do_carroceiro_e_so_para_carroceiro(api, turista, metodo, caminho):
    assert getattr(api, metodo)(caminho).status_code == 401
    assert getattr(api, metodo)(caminho, headers=turista).status_code == 403


def test_contatos_listam_carroceiros_com_whatsapp_para_quem_tem_sessao(api, turista, bento):
    assert api.get("/api/v1/carriers").status_code == 401

    contatos = api.get("/api/v1/carriers", headers=turista).json()

    assert {
        "display_name": "Bento",
        "whatsapp": "(91) 98888-0001",
        "capacity": 4,
        "is_available": True,
    } in contatos
