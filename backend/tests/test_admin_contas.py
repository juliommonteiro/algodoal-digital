"""Painel admin: usuários e carroceiros."""

import uuid

import pytest
from sqlalchemy import select

from app.models import RefreshToken, RideRequest
from app.schemas.auth import CarroceiroIn
from app.services import auth as servico_auth
from tests.conftest import precisa_de_banco

pytestmark = [pytest.mark.db, precisa_de_banco]

USUARIOS = "/api/v1/admin/users"
CARROCEIROS = "/api/v1/admin/carriers"
SENHA = "senha-segura-1"


def _conta(db, role="tourist", nome="Conta", carroceiro: CarroceiroIn | None = None):
    email = f"{role}-{uuid.uuid4().hex[:8]}@example.com"
    par = servico_auth.registrar(db, nome=nome, email=email, senha=SENHA, carroceiro=carroceiro)
    if carroceiro is None:
        par.user.role = role
    db.commit()
    return par.user, {"Authorization": f"Bearer {par.access_token}"}


@pytest.fixture
def admin(db):
    return _conta(db, "admin", "Admin Atual")


def entrar(api, email):
    return api.post("/api/v1/auth/login", json={"email": email, "password": SENHA})


# ---------------------------------------------------------------------------------- usuários


def test_lista_usuarios_com_filtros_e_sem_senha(db, api, admin):
    _, cabecalho = admin
    turista, _ = _conta(db, "tourist", "Ana Viajante")
    _conta(db, carroceiro=CarroceiroIn(whatsapp="(91) 98888-0001"), nome="Bento")

    por_email = api.get(USUARIOS, params={"q": turista.email}, headers=cabecalho).json()
    assert [u["name"] for u in por_email] == ["Ana Viajante"]
    assert "password_hash" not in por_email[0]
    carroceiros = api.get(USUARIOS, params={"perfil": "carrier", "q": "Bento"}, headers=cabecalho)
    assert [u["tem_perfil_de_carroceiro"] for u in carroceiros.json()] == [True]
    assert (
        api.get(
            USUARIOS, params={"status": "desativada", "q": turista.email}, headers=cabecalho
        ).json()
        == []
    )


def test_desativar_derruba_as_sessoes_e_impede_o_login(db, api, admin):
    _, cabecalho = admin
    alvo, sessao_do_alvo = _conta(db, "tourist")

    resposta = api.patch(f"{USUARIOS}/{alvo.id}", json={"is_active": False}, headers=cabecalho)

    assert resposta.status_code == 200, resposta.text
    assert resposta.json()["is_active"] is False
    assert api.get("/api/v1/auth/me", headers=sessao_do_alvo).status_code == 401
    assert entrar(api, alvo.email).status_code == 401
    abertas = db.scalars(
        select(RefreshToken).where(
            RefreshToken.user_id == alvo.id, RefreshToken.revoked_at.is_(None)
        )
    ).all()
    assert abertas == []

    api.patch(f"{USUARIOS}/{alvo.id}", json={"is_active": True}, headers=cabecalho)
    assert entrar(api, alvo.email).status_code == 200


def test_tornar_e_tirar_admin(db, api, admin):
    _, cabecalho = admin
    alvo, _ = _conta(db, "tourist")

    assert (
        api.patch(f"{USUARIOS}/{alvo.id}", json={"role": "admin"}, headers=cabecalho).json()["role"]
        == "admin"
    )
    novo = entrar(api, alvo.email).json()["access_token"]
    assert api.get(USUARIOS, headers={"Authorization": f"Bearer {novo}"}).status_code == 200

    volta = api.patch(f"{USUARIOS}/{alvo.id}", json={"role": "tourist"}, headers=cabecalho)
    assert volta.json()["role"] == "tourist"
    assert api.get(USUARIOS, headers={"Authorization": f"Bearer {novo}"}).status_code == 403


def test_admin_nao_muda_a_propria_conta(api, admin):
    eu, cabecalho = admin

    for corpo in ({"is_active": False}, {"role": "tourist"}):
        resposta = api.patch(f"{USUARIOS}/{eu.id}", json=corpo, headers=cabecalho)
        assert resposta.status_code == 409
        assert "própria conta" in resposta.json()["detail"]


@pytest.mark.parametrize(("perfil", "origem"), [("carrier", "Carroceiros"), ("partner", "Locais")])
def test_perfil_de_carroceiro_e_parceiro_nao_se_troca_aqui(db, api, admin, perfil, origem):
    _, cabecalho = admin
    carroceiro = CarroceiroIn(whatsapp="(91) 98888-0001") if perfil == "carrier" else None
    alvo, _ = _conta(db, perfil, carroceiro=carroceiro)

    resposta = api.patch(f"{USUARIOS}/{alvo.id}", json={"role": "admin"}, headers=cabecalho)

    assert resposta.status_code == 409
    assert origem in resposta.json()["detail"]
    # Desativar a conta continua possível.
    assert (
        api.patch(f"{USUARIOS}/{alvo.id}", json={"is_active": False}, headers=cabecalho).status_code
        == 200
    )


def test_perfil_parceiro_ou_carroceiro_nao_vem_pelo_patch(db, api, admin):
    _, cabecalho = admin
    alvo, _ = _conta(db, "tourist")

    assert (
        api.patch(f"{USUARIOS}/{alvo.id}", json={"role": "partner"}, headers=cabecalho).status_code
        == 422
    )


def test_usuario_inexistente_e_404(api, admin):
    assert (
        api.patch(
            f"{USUARIOS}/{uuid.uuid4()}", json={"is_active": False}, headers=admin[1]
        ).status_code
        == 404
    )


def test_usuarios_e_carroceiros_sao_so_do_admin(db, api):
    _, turista = _conta(db, "tourist")

    for caminho in (USUARIOS, CARROCEIROS):
        assert api.get(caminho).status_code == 401
        assert api.get(caminho, headers=turista).status_code == 403


# -------------------------------------------------------------------------------- carroceiros


def _carroceiro(db, nome="Bento"):
    return _conta(db, carroceiro=CarroceiroIn(whatsapp="(91) 98888-0001", capacity=4), nome=nome)


def test_lista_carroceiros_com_contato_e_viagens_da_semana(db, api, admin):
    usuario, _ = _carroceiro(db, "Carroça do Teste Lista")
    turista, _ = _conta(db, "tourist")
    db.add(
        RideRequest(
            tourist_id=turista.id,
            carrier_id=usuario.carrier.id,
            origin="Vila",
            destination="Praia",
            passengers=2,
            tourist_whatsapp="(91) 97777-1111",
            status="accepted",
        )
    )
    db.flush()

    (linha,) = api.get(CARROCEIROS, params={"q": "Teste Lista"}, headers=admin[1]).json()

    assert linha["email"] == usuario.email
    assert linha["whatsapp"] == "(91) 98888-0001"
    assert linha["viagens_7_dias"] == 1
    assert (linha["is_approved"], linha["is_available"], linha["conta_ativa"]) == (True, True, True)


def test_admin_edita_nome_whatsapp_e_capacidade(db, api, admin):
    usuario, _ = _carroceiro(db)

    resposta = api.patch(
        f"{CARROCEIROS}/{usuario.carrier.id}",
        json={"display_name": "Carroça do Bento", "whatsapp": "(91) 98888-0009", "capacity": 6},
        headers=admin[1],
    )

    assert resposta.status_code == 200
    assert (
        resposta.json()["display_name"],
        resposta.json()["whatsapp"],
        resposta.json()["capacity"],
    ) == (
        "Carroça do Bento",
        "(91) 98888-0009",
        6,
    )
    invalido = api.patch(
        f"{CARROCEIROS}/{usuario.carrier.id}", json={"whatsapp": "123"}, headers=admin[1]
    )
    assert invalido.status_code == 422


def test_suspenso_nao_recebe_nem_aceita_pedido_e_some_dos_contatos(db, api, admin):
    usuario, carroceiro = _carroceiro(db, "Carroça Suspensa")
    turista, sessao_turista = _conta(db, "tourist")
    pedido = api.post(
        "/api/v1/ride-requests",
        json={
            "origin": "Vila",
            "destination": "Praia",
            "passengers": 2,
            "whatsapp": "(91) 97777-1111",
        },
        headers=sessao_turista,
    ).json()

    suspenso = api.patch(
        f"{CARROCEIROS}/{usuario.carrier.id}", json={"is_approved": False}, headers=admin[1]
    )

    assert suspenso.json()["is_approved"] is False
    assert suspenso.json()["is_available"] is False
    assert api.get("/api/v1/carrier/requests", headers=carroceiro).json() == []
    aceite = api.post(f"/api/v1/carrier/requests/{pedido['id']}/accept", headers=carroceiro)
    assert aceite.status_code == 409
    assert "suspenso" in aceite.json()["detail"]
    nomes = [c["display_name"] for c in api.get("/api/v1/carriers", headers=sessao_turista).json()]
    assert "Carroça Suspensa" not in nomes
    # Ligar a disponibilidade não adianta enquanto estiver suspenso.
    eu = api.patch("/api/v1/carrier/me", json={"is_available": True}, headers=carroceiro).json()
    assert (eu["is_approved"], eu["is_available"]) == (False, False)


def test_reativar_volta_a_receber(db, api, admin):
    usuario, carroceiro = _carroceiro(db)
    api.patch(f"{CARROCEIROS}/{usuario.carrier.id}", json={"is_approved": False}, headers=admin[1])

    api.patch(f"{CARROCEIROS}/{usuario.carrier.id}", json={"is_approved": True}, headers=admin[1])
    eu = api.patch("/api/v1/carrier/me", json={"is_available": True}, headers=carroceiro).json()

    assert (eu["is_approved"], eu["is_available"]) == (True, True)


def test_filtro_de_suspensos(db, api, admin):
    usuario, _ = _carroceiro(db, "Carroça Filtro Suspensa")
    api.patch(f"{CARROCEIROS}/{usuario.carrier.id}", json={"is_approved": False}, headers=admin[1])

    suspensos = api.get(
        CARROCEIROS, params={"status": "suspenso", "q": "Filtro"}, headers=admin[1]
    ).json()
    aprovados = api.get(
        CARROCEIROS, params={"status": "aprovado", "q": "Filtro"}, headers=admin[1]
    ).json()

    assert [c["display_name"] for c in suspensos] == ["Carroça Filtro Suspensa"]
    assert aprovados == []


def test_carroceiro_inexistente_e_404(api, admin):
    assert (
        api.patch(
            f"{CARROCEIROS}/{uuid.uuid4()}", json={"capacity": 3}, headers=admin[1]
        ).status_code
        == 404
    )
