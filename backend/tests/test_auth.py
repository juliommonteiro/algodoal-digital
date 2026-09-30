"""Autenticação: cadastro, login, tokens, rotação, reuso, logout, perfis e rate limit."""

import json
import logging
import uuid
from datetime import UTC, datetime, timedelta
from typing import Annotated, Any

import jwt
import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import func, select

from app.api.deps import requer_perfil
from app.core.config import get_settings
from app.db.session import get_db
from app.models import RefreshToken, User
from app.services import auth as servico
from tests.conftest import precisa_de_banco

pytestmark = [pytest.mark.db, precisa_de_banco]

SENHA = "senha-segura-1"
CAMPOS_RESPOSTA_LOGIN = {"access_token", "refresh_token", "token_type", "user"}
CAMPOS_USUARIO = {"id", "name", "email", "role"}


# ---------------------------------------------------------------------------- apoio


def email_unico() -> str:
    return f"teste-{uuid.uuid4().hex[:10]}@example.com"


def registrar(api, email: str | None = None, senha: str = SENHA, nome: str = "Ana Teste"):
    return api.post(
        "/api/v1/auth/register",
        json={"name": nome, "email": email or email_unico(), "password": senha},
    )


def entrar(api, email: str, senha: str = SENHA):
    return api.post("/api/v1/auth/login", json={"email": email, "password": senha})


def renovar(api, refresh_token: str):
    return api.post("/api/v1/auth/refresh", json={"refresh_token": refresh_token})


def eu(api, access_token: str):
    return api.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {access_token}"})


def conta_com_sessao(api) -> tuple[str, dict[str, Any]]:
    email = email_unico()
    resposta = registrar(api, email)
    assert resposta.status_code == 201, resposta.text
    return email, resposta.json()


def forjar_token(claims: dict[str, Any], chave: str | None = None) -> str:
    return jwt.encode(claims, chave or get_settings().secret_key, algorithm="HS256")


def claims_validas(sessao: dict[str, Any]) -> dict[str, Any]:
    """Claims de um access token de verdade, para os testes mudarem uma coisa só."""
    return jwt.decode(sessao["access_token"], options={"verify_signature": False})


def sessoes_ativas(db, email: str) -> int:
    return db.scalar(
        select(func.count())
        .select_from(RefreshToken)
        .join(User, User.id == RefreshToken.user_id)
        .where(User.email == email, RefreshToken.revoked_at.is_(None))
    )


# ---------------------------------------------------------------------------- cadastro


def test_registro_cria_turista_e_guarda_hash_argon2(db, api):
    email = email_unico()
    resposta = registrar(api, email.upper())  # e-mail é normalizado em minúsculas

    assert resposta.status_code == 201
    corpo = resposta.json()
    assert set(corpo) == CAMPOS_RESPOSTA_LOGIN
    assert corpo["user"]["email"] == email
    assert corpo["user"]["role"] == "tourist"

    usuario = db.scalar(select(User).where(User.email == email))
    assert usuario.password_hash.startswith("$argon2")
    assert SENHA not in usuario.password_hash


def test_registro_com_email_duplicado_devolve_409(api):
    email = email_unico()
    assert registrar(api, email).status_code == 201

    repetido = registrar(api, email.upper())

    assert repetido.status_code == 409
    assert repetido.json() == {"detail": "Já existe uma conta com esse e-mail."}


@pytest.mark.parametrize("senha", ["", "curta", "1234567"])
def test_senha_com_menos_de_8_caracteres_devolve_422(api, senha):
    resposta = registrar(api, senha=senha)

    assert resposta.status_code == 422
    assert resposta.json()["detail"][0]["loc"] == ["body", "password"]


# ---------------------------------------------------------------------------- login


def test_login_correto_devolve_o_par_e_o_usuario(api):
    email, _ = conta_com_sessao(api)

    resposta = entrar(api, email)

    assert resposta.status_code == 200
    corpo = resposta.json()
    assert set(corpo) == CAMPOS_RESPOSTA_LOGIN
    assert corpo["token_type"] == "bearer"
    assert set(corpo["user"]) == CAMPOS_USUARIO
    assert corpo["user"]["email"] == email
    claims = jwt.decode(corpo["access_token"], options={"verify_signature": False})
    assert claims["type"] == "access"
    assert isinstance(claims["sub"], str)
    assert claims["exp"] - claims["iat"] == 15 * 60
    renovacao = jwt.decode(corpo["refresh_token"], options={"verify_signature": False})
    assert renovacao["type"] == "refresh"
    assert renovacao["exp"] - renovacao["iat"] == 30 * 24 * 3600


def test_senha_errada_e_email_inexistente_tem_a_mesma_resposta(api):
    email, _ = conta_com_sessao(api)

    senha_errada = entrar(api, email, "outra-senha-qualquer")
    inexistente = entrar(api, email_unico(), "outra-senha-qualquer")

    assert senha_errada.status_code == inexistente.status_code == 401
    assert senha_errada.content == inexistente.content  # byte a byte
    assert senha_errada.json() == {"detail": "E-mail ou senha incorretos."}
    assert senha_errada.headers.get("www-authenticate") == inexistente.headers.get(
        "www-authenticate"
    )


# ---------------------------------------------------------------------------- /me e tokens


def test_me_sem_token_401_e_com_token_valido_devolve_o_usuario(api):
    email, sessao = conta_com_sessao(api)

    assert api.get("/api/v1/auth/me").status_code == 401
    resposta = eu(api, sessao["access_token"])

    assert resposta.status_code == 200
    assert resposta.json() == sessao["user"]
    assert set(resposta.json()) == CAMPOS_USUARIO


def test_me_com_token_de_renovacao_devolve_401(api):
    """O campo `type` é o que impede usar a renovação (30 dias) como acesso."""
    _, sessao = conta_com_sessao(api)

    resposta = eu(api, sessao["refresh_token"])

    assert resposta.status_code == 401
    assert resposta.json() == {"detail": "Token inválido ou expirado."}


def test_token_expirado_devolve_401(api):
    _, sessao = conta_com_sessao(api)
    passado = datetime.now(UTC) - timedelta(minutes=30)
    vencido = claims_validas(sessao) | {
        "iat": int(passado.timestamp()),
        "exp": int((passado + timedelta(minutes=15)).timestamp()),
    }

    assert eu(api, forjar_token(vencido)).status_code == 401
    assert eu(api, sessao["access_token"]).status_code == 200  # a sessão em si segue válida


def test_token_assinado_com_outra_chave_devolve_401(api):
    _, sessao = conta_com_sessao(api)

    forjado = forjar_token(claims_validas(sessao) | {"role": "admin"}, chave="x" * 48)

    assert eu(api, forjado).status_code == 401


@pytest.mark.parametrize(
    "token",
    ["lixo", "a.b.c", "", "Basic dXNlcjpzZW5oYQ=="],
    ids=["lixo", "3-partes", "vazio", "basic"],
)
def test_token_malformado_devolve_401(api, token):
    assert eu(api, token).status_code == 401


def test_token_sem_assinatura_alg_none_devolve_401(api):
    _, sessao = conta_com_sessao(api)
    sem_assinatura = jwt.encode(claims_validas(sessao), key=None, algorithm="none")

    assert eu(api, sem_assinatura).status_code == 401


def test_usuario_inativo_perde_o_acesso(db, api):
    email, sessao = conta_com_sessao(api)
    db.scalar(select(User).where(User.email == email)).is_active = False
    db.flush()

    assert eu(api, sessao["access_token"]).status_code == 401
    assert entrar(api, email).status_code == 401


# ---------------------------------------------------------------------------- rotação


def jti_de(token: str) -> str:
    return jwt.decode(token, options={"verify_signature": False})["jti"]


def registro_de(db, token: str) -> RefreshToken:
    db.expire_all()
    return db.scalar(select(RefreshToken).where(RefreshToken.jti == jti_de(token)))


def passar_da_janela(db, token: str) -> None:
    """Recua a revogação do token para antes da janela de graça: o mesmo efeito de esperar."""
    janela = get_settings().refresh_janela_de_graca_segundos
    registro = registro_de(db, token)
    registro.revoked_at -= timedelta(seconds=janela + 1)
    db.flush()


def avisos_de_reuso(caplog) -> list[logging.LogRecord]:
    return [r for r in caplog.records if "Reuso de token de renovação" in r.getMessage()]


def test_refresh_devolve_par_novo_e_revoga_o_antigo_por_rotacao(db, api):
    _, sessao = conta_com_sessao(api)

    nova = renovar(api, sessao["refresh_token"])

    assert nova.status_code == 200
    corpo = nova.json()
    assert set(corpo) == CAMPOS_RESPOSTA_LOGIN
    assert corpo["refresh_token"] != sessao["refresh_token"]
    assert corpo["access_token"] != sessao["access_token"]
    assert eu(api, corpo["access_token"]).status_code == 200
    assert eu(api, sessao["access_token"]).status_code == 401  # a sessão antiga caiu
    antigo = registro_de(db, sessao["refresh_token"])
    assert antigo.revoked_reason == "rotation"
    assert antigo.replaced_by_jti == jti_de(corpo["refresh_token"])


def test_refresh_repetido_na_janela_devolve_o_mesmo_par_e_mantem_a_sessao(db, api, caplog):
    """Duas abas renovando quase juntas: corrida, não ataque."""
    email, sessao = conta_com_sessao(api)

    primeira = renovar(api, sessao["refresh_token"])
    with caplog.at_level(logging.INFO, logger="app.services.auth"):
        segunda = renovar(api, sessao["refresh_token"])
        terceira = renovar(api, sessao["refresh_token"])

    assert primeira.status_code == segunda.status_code == terceira.status_code == 200
    assert segunda.json() == primeira.json()  # o mesmo par, sem emitir outro
    assert terceira.json() == primeira.json()
    assert eu(api, segunda.json()["access_token"]).status_code == 200
    # Nada revogado nem emitido além da primeira rotação
    assert sessoes_ativas(db, email) == 1
    total = db.scalar(
        select(func.count())
        .select_from(RefreshToken)
        .join(User, User.id == RefreshToken.user_id)
        .where(User.email == email)
    )
    assert total == 2
    assert avisos_de_reuso(caplog) == []


def test_refresh_repetido_fora_da_janela_e_reuso_e_derruba_todas_as_sessoes(db, api, caplog):
    """O teste de reuso: token trocado que volta depois da janela = vazou."""
    email, celular = conta_com_sessao(api)  # sessão 1
    notebook = entrar(api, email).json()  # sessão 2, independente
    celular_novo = renovar(api, celular["refresh_token"]).json()
    assert sessoes_ativas(db, email) == 2
    passar_da_janela(db, celular["refresh_token"])

    with caplog.at_level(logging.WARNING, logger="app.services.auth"):
        reuso = renovar(api, celular["refresh_token"])
    avisos = avisos_de_reuso(caplog)

    assert reuso.status_code == 401
    # Tudo caiu: as duas sessões, acesso e renovação, com motivo `reuse`
    assert sessoes_ativas(db, email) == 0
    assert eu(api, celular_novo["access_token"]).status_code == 401
    assert eu(api, notebook["access_token"]).status_code == 401
    assert registro_de(db, celular_novo["refresh_token"]).revoked_reason == "reuse"
    assert registro_de(db, notebook["refresh_token"]).revoked_reason == "reuse"
    assert registro_de(db, celular["refresh_token"]).revoked_reason == "rotation"  # não muda
    # E o evento foi registrado, com o usuário e as 2 sessões derrubadas
    usuario = db.scalar(select(User).where(User.email == email))
    assert len(avisos) == 1
    assert avisos[0].levelno == logging.WARNING
    assert str(usuario.id) in avisos[0].getMessage()
    assert "2 sessão(ões)" in avisos[0].getMessage()
    # Os tokens derrubados voltando depois são só 401 (motivo reuse), sem novo evento
    assert renovar(api, celular_novo["refresh_token"]).status_code == 401
    assert len(avisos_de_reuso(caplog)) == 1
    # A conta segue utilizável: basta entrar de novo
    assert entrar(api, email).status_code == 200


def test_janela_de_graca_e_configuravel(db, api, monkeypatch):
    monkeypatch.setattr(get_settings(), "refresh_janela_de_graca_segundos", 0)
    email, sessao = conta_com_sessao(api)
    renovar(api, sessao["refresh_token"])

    # Janela zero: reapresentar na hora já é reuso
    assert renovar(api, sessao["refresh_token"]).status_code == 401
    assert sessoes_ativas(db, email) == 0


def test_token_de_logout_reapresentado_devolve_401_sem_derrubar_as_outras(db, api, caplog):
    """Outra aba reapresentando um token que já saiu: não é vazamento."""
    email, celular = conta_com_sessao(api)
    notebook = entrar(api, email).json()
    api.post("/api/v1/auth/logout", json={"refresh_token": celular["refresh_token"]})
    assert registro_de(db, celular["refresh_token"]).revoked_reason == "logout"

    with caplog.at_level(logging.WARNING, logger="app.services.auth"):
        resposta = renovar(api, celular["refresh_token"])
        passar_da_janela(db, celular["refresh_token"])  # nem depois da janela
        depois = renovar(api, celular["refresh_token"])

    assert resposta.status_code == depois.status_code == 401
    assert eu(api, notebook["access_token"]).status_code == 200
    assert renovar(api, notebook["refresh_token"]).status_code == 200
    assert sessoes_ativas(db, email) == 1
    assert avisos_de_reuso(caplog) == []


def test_cadeia_de_rotacoes_e_rastreavel_por_replaced_by_jti(db, api):
    _, sessao = conta_com_sessao(api)
    tokens = [sessao["refresh_token"]]
    for _ in range(3):  # A -> B -> C -> D
        tokens.append(renovar(api, tokens[-1]).json()["refresh_token"])

    registros = [registro_de(db, t) for t in tokens]

    for anterior, seguinte in zip(registros, registros[1:], strict=False):
        assert anterior.revoked_reason == "rotation"
        assert anterior.replaced_by_jti == seguinte.jti
    assert registros[-1].revoked_at is None
    assert registros[-1].replaced_by_jti is None
    # Seguindo a cadeia a partir de A, chega-se a D
    atual, passos = registros[0], 0
    while atual.replaced_by_jti:
        atual = db.scalar(select(RefreshToken).where(RefreshToken.jti == atual.replaced_by_jti))
        passos += 1
    assert (atual.jti, passos) == (registros[-1].jti, 3)


def test_na_janela_quem_reapresenta_o_inicio_da_cadeia_recebe_o_par_da_ponta(api):
    """A -> B -> C em sequência rápida: o par de B já não vale; quem traz A recebe o de C."""
    _, a = conta_com_sessao(api)
    b = renovar(api, a["refresh_token"]).json()
    c = renovar(api, b["refresh_token"]).json()

    resposta = renovar(api, a["refresh_token"])

    assert resposta.status_code == 200
    assert resposta.json() == c
    assert eu(api, resposta.json()["access_token"]).status_code == 200


def test_janela_nao_ressuscita_sessao_encerrada_por_logout(db, api, caplog):
    email, a = conta_com_sessao(api)
    b = renovar(api, a["refresh_token"]).json()
    api.post("/api/v1/auth/logout", json={"refresh_token": b["refresh_token"]})

    with caplog.at_level(logging.WARNING, logger="app.services.auth"):
        resposta = renovar(api, a["refresh_token"])  # dentro da janela, mas B saiu

    assert resposta.status_code == 401
    assert avisos_de_reuso(caplog) == []


def test_renovacao_desconhecida_ou_forjada_devolve_401(api):
    _, sessao = conta_com_sessao(api)
    desconhecido = jwt.decode(sessao["refresh_token"], options={"verify_signature": False})
    desconhecido["jti"] = uuid.uuid4().hex

    assert renovar(api, forjar_token(desconhecido)).status_code == 401
    assert renovar(api, sessao["access_token"]).status_code == 401  # acesso não renova
    assert renovar(api, "lixo").status_code == 401


# ---------------------------------------------------------------------------- logout


def test_logout_revoga_o_token_apresentado_e_so_a_sessao_dele(db, api):
    email, celular = conta_com_sessao(api)
    notebook = entrar(api, email).json()

    corpo = {"refresh_token": celular["refresh_token"]}
    resposta = api.post("/api/v1/auth/logout", json=corpo)

    assert resposta.status_code == 204
    assert resposta.content == b""
    assert eu(api, celular["access_token"]).status_code == 401  # o acesso cai junto
    assert eu(api, notebook["access_token"]).status_code == 200  # a outra sessão segue
    assert sessoes_ativas(db, email) == 1
    assert api.post("/api/v1/auth/logout", json=corpo).status_code == 204  # idempotente


# ---------------------------------------------------------------------------- perfis


@pytest.fixture
def app_com_rota_de_admin(db):
    """Rota de teste protegida por requer_perfil("admin"), como as da S6 vão ser."""
    app = FastAPI()

    @app.get("/so-admin")
    def so_admin(usuario: Annotated[User, Depends(requer_perfil("admin"))]) -> dict[str, str]:
        return {"ok": usuario.email}

    @app.get("/parceiro-ou-admin")
    def parceiro_ou_admin(
        usuario: Annotated[User, Depends(requer_perfil("partner", "admin"))],
    ) -> dict[str, str]:
        return {"ok": usuario.role}

    app.dependency_overrides[get_db] = lambda: db
    return TestClient(app)


def sessao_com_perfil(db, role: str) -> str:
    """Cria o usuário pelo service (sem passar pelo rate limit do cadastro)."""
    email = email_unico()
    par = servico.registrar(db, nome="Perfil Teste", email=email, senha=SENHA)
    par.user.role = role
    db.flush()
    # Entra de novo para o token já nascer com a claim role certa
    return servico.autenticar(db, email=email, senha=SENHA).access_token


def test_requer_perfil_deixa_passar_quem_tem_o_papel_e_barra_quem_nao_tem(
    db, app_com_rota_de_admin
):
    cliente = app_com_rota_de_admin
    cabecalho = lambda token: {"Authorization": f"Bearer {token}"}  # noqa: E731
    admin = sessao_com_perfil(db, "admin")
    parceiro = sessao_com_perfil(db, "partner")
    turista = sessao_com_perfil(db, "tourist")

    assert cliente.get("/so-admin", headers=cabecalho(admin)).status_code == 200
    negado = cliente.get("/so-admin", headers=cabecalho(turista))
    assert negado.status_code == 403
    assert negado.json() == {"detail": "Seu perfil não tem acesso a este recurso."}
    assert cliente.get("/so-admin", headers=cabecalho(parceiro)).status_code == 403
    assert cliente.get("/so-admin").status_code == 401  # sem token: 401, não 403

    assert cliente.get("/parceiro-ou-admin", headers=cabecalho(parceiro)).status_code == 200
    assert cliente.get("/parceiro-ou-admin", headers=cabecalho(admin)).status_code == 200
    assert cliente.get("/parceiro-ou-admin", headers=cabecalho(turista)).status_code == 403


def test_perfil_vem_do_banco_e_nao_do_token(db, app_com_rota_de_admin):
    """Rebaixar alguém vale na hora, mesmo com o token ainda dizendo role=admin."""
    token = sessao_com_perfil(db, "admin")
    assert jwt.decode(token, options={"verify_signature": False})["role"] == "admin"
    usuario_id = jwt.decode(token, options={"verify_signature": False})["sub"]
    db.get(User, uuid.UUID(usuario_id)).role = "tourist"
    db.flush()

    resposta = app_com_rota_de_admin.get("/so-admin", headers={"Authorization": f"Bearer {token}"})

    assert resposta.status_code == 403


def test_requer_perfil_sem_perfis_e_erro_de_programacao():
    with pytest.raises(ValueError):
        requer_perfil()


# ---------------------------------------------------------------------------- rate limit


def test_login_estoura_em_5_por_minuto_com_429(api):
    email = email_unico()
    respostas = [entrar(api, email, "senha-errada-1").status_code for _ in range(6)]

    assert respostas == [401, 401, 401, 401, 401, 429]
    bloqueado = entrar(api, email, "senha-errada-1")
    assert bloqueado.status_code == 429
    assert bloqueado.headers["retry-after"] == "60"
    assert bloqueado.json() == {"detail": "Muitas tentativas. Espere um minuto e tente de novo."}


def test_registro_estoura_em_3_por_minuto_com_429(api):
    respostas = [registrar(api).status_code for _ in range(4)]

    assert respostas == [201, 201, 201, 429]


# ---------------------------------------------------------------------------- vazamento


def _chaves(valor: Any) -> set[str]:
    if isinstance(valor, dict):
        return set(valor) | {k for v in valor.values() for k in _chaves(v)}
    if isinstance(valor, list):
        return {k for v in valor for k in _chaves(v)}
    return set()


def test_nenhuma_resposta_da_api_contem_password_hash(db, api):
    email, sessao = conta_com_sessao(api)
    registro = registrar(api)
    login = entrar(api, email)
    renovado = renovar(api, login.json()["refresh_token"])
    local_id = api.get("/api/v1/places").json()
    respostas = {
        "POST /auth/register": registro,
        "POST /auth/register (409)": registrar(api, email),
        "POST /auth/register (422)": registrar(api, senha="curta"),
        "POST /auth/login": login,
        "POST /auth/login (401)": entrar(api, email, "errada-errada"),
        "POST /auth/refresh": renovado,
        "POST /auth/refresh (401)": renovar(api, "lixo"),
        "GET /auth/me": eu(api, renovado.json()["access_token"]),
        "GET /auth/me (401)": eu(api, "lixo"),
        "POST /auth/logout": api.post(
            "/api/v1/auth/logout", json={"refresh_token": sessao["refresh_token"]}
        ),
        "GET /categories": api.get("/api/v1/categories"),
        "GET /places": api.get("/api/v1/places"),
        "GET /health": api.get("/api/v1/health"),
        "GET /openapi.json": api.get("/api/v1/openapi.json"),
    }
    if local_id:
        respostas["GET /places/{id}"] = api.get(f"/api/v1/places/{local_id[0]['id']}")
    hash_real = db.scalar(select(User.password_hash).where(User.email == email))

    for rota, resposta in respostas.items():
        assert "password_hash" not in resposta.text, rota
        assert "$argon2" not in resposta.text, rota
        assert hash_real not in resposta.text, rota
        if resposta.content:
            assert "password_hash" not in _chaves(json.loads(resposta.content)), rota
