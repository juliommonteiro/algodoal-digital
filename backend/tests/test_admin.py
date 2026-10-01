"""Painel administrativo: /api/v1/admin. Usa a sessão com ROLLBACK de sempre."""

import uuid
from decimal import Decimal

import pytest
from sqlalchemy import select

from app.models import Category, Place
from app.services import auth as servico_auth
from tests.conftest import precisa_de_banco

pytestmark = [pytest.mark.db, precisa_de_banco]

ADMIN = "/api/v1/admin"


def _token(db, role: str) -> dict[str, str]:
    email = f"{role}-{uuid.uuid4().hex[:8]}@example.com"
    par = servico_auth.registrar(db, nome=f"Teste {role}", email=email, senha="senha-segura-1")
    par.user.role = role
    db.flush()
    acesso = servico_auth.autenticar(db, email=email, senha="senha-segura-1").access_token
    return {"Authorization": f"Bearer {acesso}"}


@pytest.fixture
def admin(db):
    return _token(db, "admin")


@pytest.fixture
def turista(db):
    return _token(db, "tourist")


def _categoria(db, mae: Category | None = None) -> Category:
    sufixo = uuid.uuid4().hex[:8]
    c = Category(
        slug=f"admin-{sufixo}", name=f"Categoria {sufixo}", parent_id=mae.id if mae else None
    )
    db.add(c)
    db.flush()
    return c


def _local(db, cat: Category, *, publicado=True, removido=False, nome=None, kind="beach") -> Place:
    from datetime import UTC, datetime

    p = Place(
        name=nome or f"Local {uuid.uuid4().hex[:8]}",
        kind=kind,
        category_id=cat.id,
        latitude=Decimal("-0.590000"),
        longitude=Decimal("-47.586000"),
        is_published=publicado,
        deleted_at=datetime.now(UTC) if removido else None,
    )
    db.add(p)
    db.flush()
    return p


def _corpo(cat: Category, **extra) -> dict:
    return {
        "name": "Mirante Novo",
        "kind": "tourist_point",
        "category_id": str(cat.id),
        "latitude": -0.5895,
        "longitude": -47.5860,
        **extra,
    }


def _nomes(resposta) -> set[str]:
    return {item["name"] for item in resposta.json()}


# ---------------------------------------------------------------------------- listagem


def test_painel_lista_nao_publicados_e_removidos_e_o_publico_nao(db, api, admin):
    cat = _categoria(db)
    publicado = _local(db, cat)
    rascunho = _local(db, cat, publicado=False)
    removido = _local(db, cat, removido=True)

    painel = api.get(f"{ADMIN}/places", params={"category": cat.slug}, headers=admin)
    publico = api.get("/api/v1/places", params={"category": cat.slug})

    assert painel.status_code == 200
    assert _nomes(painel) == {publicado.name, rascunho.name, removido.name}
    por_nome = {item["name"]: item for item in painel.json()}
    assert por_nome[removido.name]["deleted_at"] is not None
    assert por_nome[rascunho.name]["is_published"] is False
    assert {"deleted_at", "source", "created_at"} <= set(por_nome[publicado.name])
    assert _nomes(publico) == {publicado.name}


@pytest.mark.parametrize(
    ("status_", "esperado"),
    [("publicado", "publicado"), ("rascunho", "rascunho"), ("removido", "removido")],
)
def test_filtro_por_status(db, api, admin, status_, esperado):
    cat = _categoria(db)
    locais = {
        "publicado": _local(db, cat),
        "rascunho": _local(db, cat, publicado=False),
        "removido": _local(db, cat, removido=True),
    }

    resposta = api.get(
        f"{ADMIN}/places", params={"category": cat.slug, "status": status_}, headers=admin
    )

    assert _nomes(resposta) == {locais[esperado].name}


def test_filtros_por_tipo_busca_e_subcategoria(db, api, admin):
    mae = _categoria(db)
    filha = _categoria(db, mae)
    praia = _local(db, filha, nome="Praia do Teste Admin", kind="beach")
    _local(db, filha, nome="Trilha do Teste Admin", kind="trail")

    por_tipo = api.get(
        f"{ADMIN}/places", params={"category": mae.slug, "kind": "beach"}, headers=admin
    )
    por_nome = api.get(
        f"{ADMIN}/places", params={"category": mae.slug, "q": "praia do teste"}, headers=admin
    )

    assert _nomes(por_tipo) == {praia.name}  # pela mãe, traz a filha
    assert _nomes(por_nome) == {praia.name}
    assert api.get(f"{ADMIN}/places", params={"status": "sumido"}, headers=admin).status_code == 422


# ---------------------------------------------------------------------------- escrita


def test_criar_editar_e_remover_logicamente(db, api, admin):
    cat = _categoria(db)

    criado = api.post(
        f"{ADMIN}/places",
        json=_corpo(
            cat, kind="business", business={"whatsapp": "(91) 95555-0190", "services": ["café"]}
        ),
        headers=admin,
    )
    assert criado.status_code == 201
    corpo = criado.json()
    assert corpo["source"] == "campo"  # dado real: o seed --reset não apaga
    assert corpo["business"]["whatsapp"] == "(91) 95555-0190"
    id_ = corpo["id"]

    editado = api.patch(
        f"{ADMIN}/places/{id_}",
        json={
            "name": "Mirante Renomeado",
            "business": {"phone": "(91) 95555-0191", "is_partner": True},
        },
        headers=admin,
    )
    assert editado.status_code == 200
    assert editado.json()["name"] == "Mirante Renomeado"
    assert editado.json()["business"] == {
        "whatsapp": None,  # o objeto substitui o negócio por inteiro
        "phone": "(91) 95555-0191",
        "opening_hours": None,
        "price_range": None,
        "services": [],
        "is_partner": True,
    }
    assert editado.json()["kind"] == "business"  # o que não veio não muda

    removido = api.delete(f"{ADMIN}/places/{id_}", headers=admin)
    assert removido.status_code == 200
    assert removido.json()["deleted_at"] is not None
    # Lógica: o registro continua no banco, só some do público
    db.expire_all()
    no_banco = db.get(Place, uuid.UUID(id_))
    assert no_banco is not None and no_banco.deleted_at is not None
    assert api.get(f"/api/v1/places/{id_}").status_code == 404
    assert api.get(f"{ADMIN}/places/{id_}", headers=admin).status_code == 200


def test_patch_com_business_nulo_remove_os_dados_comerciais(db, api, admin):
    cat = _categoria(db)
    id_ = api.post(
        f"{ADMIN}/places", json=_corpo(cat, business={"services": ["x"]}), headers=admin
    ).json()["id"]

    resposta = api.patch(f"{ADMIN}/places/{id_}", json={"business": None}, headers=admin)

    assert resposta.json()["business"] is None


def test_restaurar_desfaz_a_remocao(db, api, admin):
    cat = _categoria(db)
    local = _local(db, cat, removido=True)

    resposta = api.post(f"{ADMIN}/places/{local.id}/restaurar", headers=admin)

    assert resposta.status_code == 200
    assert resposta.json()["deleted_at"] is None
    assert local.name in _nomes(api.get("/api/v1/places", params={"category": cat.slug}))


def test_detalhe_de_nao_publicado_e_404(db, api, admin):
    rascunho = _local(db, _categoria(db), publicado=False)

    assert api.get(f"{ADMIN}/places/{rascunho.id}", headers=admin).json()["name"] == rascunho.name
    assert api.get(f"{ADMIN}/places/{uuid.uuid4()}", headers=admin).status_code == 404
    assert (
        api.patch(f"{ADMIN}/places/{uuid.uuid4()}", json={"name": "x"}, headers=admin).status_code
        == 404
    )


# ---------------------------------------------------------------------------- validação


@pytest.mark.parametrize(
    ("campo", "valor"),
    [("latitude", -0.70), ("latitude", -0.50), ("longitude", -47.70), ("longitude", -47.40)],
)
def test_coordenada_fora_da_area_do_mapa_e_recusada(db, api, admin, campo, valor):
    cat = _categoria(db)

    criar = api.post(f"{ADMIN}/places", json=_corpo(cat, **{campo: valor}), headers=admin)
    local = _local(db, cat)
    editar = api.patch(f"{ADMIN}/places/{local.id}", json={campo: valor}, headers=admin)

    for resposta in (criar, editar):
        assert resposta.status_code == 422
        (erro,) = resposta.json()["detail"]
        assert erro["loc"] == ["body", campo]
        assert "não apareceria no mapa" in erro["msg"]


def test_campo_obrigatorio_nulo_e_categoria_inexistente(db, api, admin):
    local = _local(db, _categoria(db))

    nulo = api.patch(f"{ADMIN}/places/{local.id}", json={"name": None}, headers=admin)
    vazio = api.patch(f"{ADMIN}/places/{local.id}", json={"name": "   "}, headers=admin)
    categoria = api.patch(
        f"{ADMIN}/places/{local.id}", json={"category_id": str(uuid.uuid4())}, headers=admin
    )

    assert nulo.status_code == vazio.status_code == categoria.status_code == 422
    assert nulo.json()["detail"][0]["loc"] == ["body", "name"]
    assert vazio.json()["detail"][0]["msg"] == "Informe o nome do local."
    assert categoria.json()["detail"] == [
        {
            "loc": ["body", "category_id"],
            "msg": "Categoria inexistente.",
            "type": "categoria_inexistente",
        }
    ]


def test_horario_invalido_e_recusado_no_campo(db, api, admin):
    cat = _categoria(db)

    resposta = api.post(
        f"{ADMIN}/places",
        json=_corpo(cat, business={"opening_hours": {"seg": [["22:00", "08:00"]]}}),
        headers=admin,
    )

    assert resposta.status_code == 422
    assert resposta.json()["detail"][0]["loc"] == ["body", "business", "opening_hours"]


# ---------------------------------------------------------------------------- acesso


def _rotas(db) -> list[tuple[str, str, dict | None]]:
    cat = _categoria(db)
    id_ = _local(db, cat).id
    return [
        ("get", f"{ADMIN}/places", None),
        ("post", f"{ADMIN}/places", _corpo(cat)),
        ("get", f"{ADMIN}/places/{id_}", None),
        ("patch", f"{ADMIN}/places/{id_}", {"name": "x"}),
        ("delete", f"{ADMIN}/places/{id_}", None),
        ("post", f"{ADMIN}/places/{id_}/restaurar", None),
        ("get", f"{ADMIN}/categories", None),
    ]


def test_toda_rota_do_painel_da_401_sem_token_e_403_para_outro_perfil(db, api, turista):
    carroceiro = _token(db, "carrier")
    parceiro = _token(db, "partner")
    rotas = _rotas(db)

    for metodo, caminho, corpo in rotas:
        chamar = getattr(api, metodo)
        kwargs = {"json": corpo} if corpo is not None else {}
        assert chamar(caminho, **kwargs).status_code == 401, f"{metodo} {caminho} sem token"
        for perfil, cabecalho in (
            ("tourist", turista),
            ("carrier", carroceiro),
            ("partner", parceiro),
        ):
            resposta = chamar(caminho, headers=cabecalho, **kwargs)
            assert resposta.status_code == 403, f"{metodo} {caminho} com {perfil}"
    # Nada foi escrito pelas tentativas negadas
    assert db.scalar(select(Place).where(Place.name == "Mirante Novo")) is None
