"""Parceiro edita o próprio estabelecimento (#26): o admin liga a conta pelo e-mail do dono."""

import uuid

import pytest
from sqlalchemy import select

from app.models import Category, User
from app.schemas.auth import CarroceiroIn
from app.services import auth as servico_auth
from tests.conftest import precisa_de_banco

pytestmark = [pytest.mark.db, precisa_de_banco]

ADMIN = "/api/v1/admin"
PARCEIRO = "/api/v1/partner"
SENHA = "senha-segura-1"


def _conta(db, role: str = "tourist", carroceiro: CarroceiroIn | None = None):
    email = f"{role}-{uuid.uuid4().hex[:8]}@example.com"
    par = servico_auth.registrar(
        db, nome=f"Conta {role}", email=email, senha=SENHA, carroceiro=carroceiro
    )
    par.user.role = role if carroceiro is None else "carrier"
    db.commit()  # fecha o savepoint: o rollback de uma rota com erro não desfaz o perfil
    return email, {"Authorization": f"Bearer {par.access_token}"}


@pytest.fixture
def admin(db):
    return _conta(db, "admin")[1]


@pytest.fixture
def categoria(db) -> Category:
    c = Category(slug=f"parceiro-{uuid.uuid4().hex[:8]}", name="Restaurantes")
    db.add(c)
    db.flush()
    return c


def _criar(api, admin, categoria, dono: str | None = None, **negocio):
    resposta = api.post(
        f"{ADMIN}/places",
        json={
            "name": "Restaurante Maré Alta",
            "kind": "business",
            "category_id": str(categoria.id),
            "latitude": -0.5895,
            "longitude": -47.5860,
            "description": "Peixe na orla.",
            "business": {"whatsapp": "(91) 95555-0100", "owner_email": dono, **negocio},
        },
        headers=admin,
    )
    return resposta


def _papel(db, email: str) -> str:
    db.expire_all()
    return db.scalar(select(User.role).where(User.email == email))


# ------------------------------------------------------------------ admin liga o dono


def test_admin_liga_turista_como_dono_e_ele_vira_parceiro(db, api, admin, categoria):
    email, _ = _conta(db)

    criado = _criar(api, admin, categoria, dono=email.upper())  # e-mail sem diferenciar caixa

    assert criado.status_code == 201, criado.text
    assert criado.json()["business"]["owner_email"] == email
    assert _papel(db, email) == "partner"
    # O dono não aparece para o público.
    publico = api.get(f"/api/v1/places/{criado.json()['id']}").json()
    assert "owner_email" not in publico["business"]


def test_dono_precisa_ter_conta(api, admin, categoria):
    resposta = _criar(api, admin, categoria, dono="ninguem@example.com")

    assert resposta.status_code == 422
    (erro,) = resposta.json()["detail"]
    assert erro["loc"] == ["body", "business", "owner_email"]
    assert "criar a conta" in erro["msg"]


@pytest.mark.parametrize("perfil", ["admin", "carrier"])
def test_carroceiro_e_admin_nao_viram_dono(db, api, admin, categoria, perfil):
    carroceiro = CarroceiroIn(whatsapp="(91) 98888-0001") if perfil == "carrier" else None
    email, _ = _conta(db, perfil, carroceiro)

    resposta = _criar(api, admin, categoria, dono=email)

    assert resposta.status_code == 422
    assert resposta.json()["detail"][0]["loc"] == ["body", "business", "owner_email"]
    assert _papel(db, email) == perfil


def test_tirar_o_dono_devolve_a_conta_para_turista(db, api, admin, categoria):
    email, _ = _conta(db)
    id_ = _criar(api, admin, categoria, dono=email).json()["id"]

    sem_dono = api.patch(
        f"{ADMIN}/places/{id_}", json={"business": {"owner_email": None}}, headers=admin
    )

    assert sem_dono.status_code == 200
    assert sem_dono.json()["business"]["owner_email"] is None
    assert _papel(db, email) == "tourist"


def test_quem_tem_outro_estabelecimento_continua_parceiro(db, api, admin, categoria):
    email, _ = _conta(db)
    primeiro = _criar(api, admin, categoria, dono=email).json()["id"]
    _criar(api, admin, categoria, dono=email)

    api.patch(f"{ADMIN}/places/{primeiro}", json={"business": None}, headers=admin)

    assert _papel(db, email) == "partner"


def test_trocar_de_dono_rebaixa_o_antigo_e_promove_o_novo(db, api, admin, categoria):
    antigo, _ = _conta(db)
    novo, _ = _conta(db)
    id_ = _criar(api, admin, categoria, dono=antigo).json()["id"]

    api.patch(f"{ADMIN}/places/{id_}", json={"business": {"owner_email": novo}}, headers=admin)

    assert (_papel(db, antigo), _papel(db, novo)) == ("tourist", "partner")


# ----------------------------------------------------------------- parceiro edita


@pytest.fixture
def parceiro(db, api, admin, categoria):
    """Turista ligado como dono de um restaurante; devolve (cabeçalho, id do local)."""
    email, _ = _conta(db)
    id_ = _criar(api, admin, categoria, dono=email, services=["Pix"]).json()["id"]
    # O perfil mudou para parceiro: entra de novo para o token sair com o perfil certo.
    acesso = servico_auth.autenticar(db, email=email, senha=SENHA).access_token
    return {"Authorization": f"Bearer {acesso}"}, id_


def test_parceiro_ve_so_os_proprios_estabelecimentos(db, api, admin, categoria, parceiro):
    cabecalho, id_ = parceiro
    _criar(api, admin, categoria)  # de ninguém

    lista = api.get(f"{PARCEIRO}/places", headers=cabecalho)

    assert lista.status_code == 200
    assert [p["id"] for p in lista.json()] == [id_]


def test_parceiro_edita_descricao_horarios_contatos_servicos_e_preco(api, parceiro):
    cabecalho, id_ = parceiro

    resposta = api.patch(
        f"{PARCEIRO}/places/{id_}",
        json={
            "description": "Peixe fresco e pratos regionais na orla.",
            "whatsapp": "(91) 95555-0111",
            "phone": "",
            "opening_hours": {"seg": [["09:00", "15:00"], ["18:00", "22:00"]]},
            "price_range": "$$",
            "services": ["Pix", "Wi-Fi"],
        },
        headers=cabecalho,
    )

    assert resposta.status_code == 200, resposta.text
    corpo = resposta.json()
    assert corpo["description"] == "Peixe fresco e pratos regionais na orla."
    assert corpo["business"]["whatsapp"] == "(91) 95555-0111"
    assert corpo["business"]["phone"] is None
    assert corpo["business"]["opening_hours"] == {"seg": [["09:00", "15:00"], ["18:00", "22:00"]]}
    assert corpo["business"]["services"] == ["Pix", "Wi-Fi"]
    # O público vê a mudança.
    assert api.get(f"/api/v1/places/{id_}").json()["business"]["price_range"] == "$$"


def test_o_que_nao_vem_no_corpo_nao_muda(api, parceiro):
    cabecalho, id_ = parceiro

    resposta = api.patch(f"{PARCEIRO}/places/{id_}", json={"price_range": "$"}, headers=cabecalho)

    assert resposta.json()["business"]["services"] == ["Pix"]
    assert resposta.json()["business"]["whatsapp"] == "(91) 95555-0100"
    assert resposta.json()["description"] == "Peixe na orla."


def test_parceiro_tira_e_volta_do_mapa(api, parceiro):
    cabecalho, id_ = parceiro

    api.patch(f"{PARCEIRO}/places/{id_}", json={"is_published": False}, headers=cabecalho)
    assert api.get(f"/api/v1/places/{id_}").status_code == 404
    # Continua no painel dele, para poder voltar.
    assert api.get(f"{PARCEIRO}/places/{id_}", headers=cabecalho).status_code == 200

    api.patch(f"{PARCEIRO}/places/{id_}", json={"is_published": True}, headers=cabecalho)
    assert api.get(f"/api/v1/places/{id_}").status_code == 200


@pytest.mark.parametrize(
    "campo",
    [
        {"name": "Outro nome"},
        {"category_id": str(uuid.uuid4())},
        {"latitude": -0.59},
        {"kind": "beach"},
        {"is_partner": True},
        {"owner_email": "outro@example.com"},
    ],
)
def test_parceiro_nao_muda_o_que_e_do_admin(api, parceiro, campo):
    cabecalho, id_ = parceiro

    assert api.patch(f"{PARCEIRO}/places/{id_}", json=campo, headers=cabecalho).status_code == 422


def test_horario_invalido_devolve_422_no_campo(api, parceiro):
    cabecalho, id_ = parceiro

    resposta = api.patch(
        f"{PARCEIRO}/places/{id_}",
        json={"opening_hours": {"seg": [["22:00", "09:00"]]}},
        headers=cabecalho,
    )

    assert resposta.status_code == 422
    assert resposta.json()["detail"][0]["loc"] == ["body", "opening_hours"]


def test_parceiro_nao_edita_estabelecimento_de_outra_pessoa(db, api, admin, categoria, parceiro):
    cabecalho, _ = parceiro
    outro_dono, _ = _conta(db)
    alheio = _criar(api, admin, categoria, dono=outro_dono).json()["id"]

    assert api.get(f"{PARCEIRO}/places/{alheio}", headers=cabecalho).status_code == 404
    resposta = api.patch(
        f"{PARCEIRO}/places/{alheio}", json={"price_range": "$"}, headers=cabecalho
    )
    assert resposta.status_code == 404


def test_removido_pelo_admin_some_do_painel_do_parceiro(db, api, admin, parceiro):
    cabecalho, id_ = parceiro

    api.delete(f"{ADMIN}/places/{id_}", headers=admin)

    assert api.get(f"{PARCEIRO}/places", headers=cabecalho).json() == []
    assert api.get(f"{PARCEIRO}/places/{id_}", headers=cabecalho).status_code == 404


def test_painel_do_parceiro_e_so_para_parceiro(db, api):
    _, turista = _conta(db)

    assert api.get(f"{PARCEIRO}/places").status_code == 401
    assert api.get(f"{PARCEIRO}/places", headers=turista).status_code == 403


def test_rascunho_aparece_para_o_dono(db, api, admin, categoria):
    email, _ = _conta(db)
    resposta = api.post(
        f"{ADMIN}/places",
        json={
            "name": "Ainda não aberto",
            "kind": "business",
            "category_id": str(categoria.id),
            "latitude": -0.5895,
            "longitude": -47.5860,
            "is_published": False,
            "business": {"owner_email": email},
        },
        headers=admin,
    )
    acesso = servico_auth.autenticar(db, email=email, senha=SENHA).access_token

    lista = api.get(f"{PARCEIRO}/places", headers={"Authorization": f"Bearer {acesso}"}).json()

    assert [p["id"] for p in lista] == [resposta.json()["id"]]
    assert lista[0]["is_published"] is False
