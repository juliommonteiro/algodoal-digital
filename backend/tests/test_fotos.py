"""Fotos dos locais (#29): admin e parceiro enviam, apagam e escolhem a capa."""

import uuid
from pathlib import Path

import pytest
from starlette.staticfiles import StaticFiles

from app.core.config import get_settings
from app.main import app
from app.models import Category
from app.services import auth as servico_auth
from app.services.fotos import LIMITE_POR_LOCAL, TAMANHO_MAXIMO
from tests.conftest import precisa_de_banco

pytestmark = [pytest.mark.db, precisa_de_banco]

ADMIN = "/api/v1/admin"
PARCEIRO = "/api/v1/partner"
SENHA = "senha-segura-1"

JPEG = b"\xff\xd8\xff\xe0" + b"jpeg de teste" * 10
PNG = b"\x89PNG\r\n\x1a\n" + b"png de teste"
WEBP = b"RIFF\x00\x00\x00\x00WEBPVP8 " + b"webp de teste"


@pytest.fixture(autouse=True)
def pasta_de_fotos(tmp_path, monkeypatch) -> Path:
    """Grava e serve as fotos numa pasta temporária, nunca em backend/media."""
    monkeypatch.setattr(get_settings(), "media_dir", str(tmp_path))
    (montagem,) = [r for r in app.routes if getattr(r, "name", None) == "media"]
    temporaria = StaticFiles(directory=str(tmp_path))
    monkeypatch.setattr(montagem, "app", temporaria)
    return tmp_path


def _conta(db, role: str) -> tuple[str, dict[str, str]]:
    email = f"{role}-{uuid.uuid4().hex[:8]}@example.com"
    par = servico_auth.registrar(db, nome=f"Conta {role}", email=email, senha=SENHA)
    par.user.role = role
    db.commit()
    return email, {"Authorization": f"Bearer {par.access_token}"}


@pytest.fixture
def admin(db):
    return _conta(db, "admin")[1]


@pytest.fixture
def local(db, api, admin) -> str:
    categoria = Category(slug=f"fotos-{uuid.uuid4().hex[:8]}", name="Pousadas")
    db.add(categoria)
    db.flush()
    resposta = api.post(
        f"{ADMIN}/places",
        json={
            "name": "Pousada com fotos",
            "kind": "business",
            "category_id": str(categoria.id),
            "latitude": -0.5895,
            "longitude": -47.5860,
            "business": {"whatsapp": "(91) 95555-0100"},
        },
        headers=admin,
    )
    return resposta.json()["id"]


def enviar(api, quem, local_id: str, conteudo: bytes = JPEG, tipo: str = "image/jpeg", base=ADMIN):
    return api.post(
        f"{base}/places/{local_id}/photos",
        content=conteudo,
        headers={**quem, "Content-Type": tipo},
    )


# ----------------------------------------------------------------------------- enviar


def test_admin_envia_foto_e_o_turista_ve(api, admin, local, pasta_de_fotos):
    resposta = enviar(api, admin, local)

    assert resposta.status_code == 201, resposta.text
    (foto,) = resposta.json()
    assert foto["position"] == 0
    assert foto["storage_key"].startswith(f"places/{local}/")
    assert foto["storage_key"].endswith(".jpg")
    assert (pasta_de_fotos / foto["storage_key"]).read_bytes() == JPEG
    # Público: a foto aparece no local e o arquivo é servido em /api/v1/media.
    assert api.get(f"/api/v1/places/{local}").json()["photos"] == [foto]
    servida = api.get(f"/api/v1/media/{foto['storage_key']}")
    assert servida.status_code == 200
    assert servida.content == JPEG
    assert servida.headers["content-type"] == "image/jpeg"


@pytest.mark.parametrize(("conteudo", "extensao"), [(PNG, "png"), (WEBP, "webp")])
def test_aceita_png_e_webp(api, admin, local, conteudo, extensao):
    (foto,) = enviar(api, admin, local, conteudo, f"image/{extensao}").json()

    assert foto["storage_key"].endswith(f".{extensao}")


def test_o_tipo_vem_dos_bytes_e_nao_do_cabecalho(api, admin, local):
    (foto,) = enviar(api, admin, local, PNG, "image/jpeg").json()

    assert foto["storage_key"].endswith(".png")


@pytest.mark.parametrize(
    "conteudo", [b"GIF89a" + b"x" * 20, b"<svg xmlns='http://www.w3.org/2000/svg'/>", b"", b"oi"]
)
def test_recusa_o_que_nao_e_jpg_png_ou_webp(api, admin, local, pasta_de_fotos, conteudo):
    resposta = enviar(api, admin, local, conteudo)

    assert resposta.status_code == 415
    assert resposta.json()["detail"] == "Use uma foto em JPG, PNG ou WebP."
    assert list(pasta_de_fotos.rglob("*.*")) == []


def test_recusa_foto_maior_que_5_mb(api, admin, local, pasta_de_fotos):
    resposta = enviar(api, admin, local, JPEG + b"x" * TAMANHO_MAXIMO)

    assert resposta.status_code == 413
    assert list(pasta_de_fotos.rglob("*.*")) == []


def test_limite_de_fotos_por_local(api, admin, local):
    for _ in range(LIMITE_POR_LOCAL):
        assert enviar(api, admin, local).status_code == 201

    resposta = enviar(api, admin, local)

    assert resposta.status_code == 409
    assert "até 6 fotos" in resposta.json()["detail"]


# ------------------------------------------------------------------ apagar e capa


def test_apagar_tira_o_arquivo_e_renumera(api, admin, local, pasta_de_fotos):
    for _ in range(3):
        enviar(api, admin, local)
    primeira, segunda, terceira = api.get(f"{ADMIN}/places/{local}", headers=admin).json()["photos"]

    resposta = api.delete(f"{ADMIN}/places/{local}/photos/{primeira['id']}", headers=admin)

    assert resposta.status_code == 200
    assert [(f["id"], f["position"]) for f in resposta.json()] == [
        (segunda["id"], 0),
        (terceira["id"], 1),
    ]
    assert not (pasta_de_fotos / primeira["storage_key"]).exists()


def test_escolher_a_capa_poe_a_foto_em_primeiro(api, admin, local):
    for _ in range(3):
        enviar(api, admin, local)
    a, b, c = api.get(f"{ADMIN}/places/{local}", headers=admin).json()["photos"]

    resposta = api.post(f"{ADMIN}/places/{local}/photos/{c['id']}/capa", headers=admin)

    assert [f["id"] for f in resposta.json()] == [c["id"], a["id"], b["id"]]
    assert api.get(f"/api/v1/places/{local}").json()["photos"][0]["id"] == c["id"]


def test_foto_de_outro_local_e_404(api, admin, local, db):
    outro = api.post(
        f"{ADMIN}/places",
        json={
            "name": "Outro",
            "kind": "beach",
            "category_id": api.get(f"{ADMIN}/places/{local}", headers=admin).json()["category_id"],
            "latitude": -0.5895,
            "longitude": -47.5860,
        },
        headers=admin,
    ).json()["id"]
    (foto,) = enviar(api, admin, outro).json()

    assert (
        api.delete(f"{ADMIN}/places/{local}/photos/{foto['id']}", headers=admin).status_code == 404
    )
    assert (
        api.post(f"{ADMIN}/places/{local}/photos/{foto['id']}/capa", headers=admin).status_code
        == 404
    )


# ------------------------------------------------------------------------- parceiro


def test_parceiro_envia_e_apaga_foto_do_proprio_estabelecimento(db, api, admin, local):
    email, _ = _conta(db, "tourist")
    api.patch(
        f"{ADMIN}/places/{local}",
        json={"business": {"whatsapp": "(91) 95555-0100", "owner_email": email}},
        headers=admin,
    )
    acesso = servico_auth.autenticar(db, email=email, senha=SENHA).access_token
    parceiro = {"Authorization": f"Bearer {acesso}"}

    (foto,) = enviar(api, parceiro, local, base=PARCEIRO).json()
    apagada = api.delete(f"{PARCEIRO}/places/{local}/photos/{foto['id']}", headers=parceiro)

    assert apagada.status_code == 200
    assert apagada.json() == []


def test_parceiro_nao_mexe_em_fotos_de_outro_local(db, api, local):
    _, outro_parceiro = _conta(db, "partner")

    assert enviar(api, outro_parceiro, local, base=PARCEIRO).status_code == 404


def test_turista_e_anonimo_nao_enviam(db, api, local):
    _, turista = _conta(db, "tourist")

    assert enviar(api, turista, local, base=PARCEIRO).status_code == 403
    assert enviar(api, turista, local).status_code == 403
    assert enviar(api, {}, local).status_code == 401
