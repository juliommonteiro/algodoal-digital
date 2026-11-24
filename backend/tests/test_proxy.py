"""Produção atrás do Caddy: IP real do cliente (X-Forwarded-For), só de proxy confiável, no rate
limit e no log; documentação da API fora do ar em produção."""

import json
import logging
from collections.abc import Callable, Generator

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.core.limites import limiter
from app.db.session import get_db
from app.main import create_app
from tests.conftest import precisa_de_banco

# Mesmo endereço fixo do Caddy no compose.prod.yml.
CADDY = "172.28.89.10"
OUTRO_CONTAINER = "172.28.89.20"
CHAVE_DE_PRODUCAO = "x" * 48

FabricaDeApp = Callable[..., FastAPI]


@pytest.fixture
def fabrica(monkeypatch) -> Generator[FabricaDeApp, None, None]:
    """Monta um app novo com as variáveis dadas (create_app lê a configuração ao montar)."""

    def montar(**variaveis: str) -> FastAPI:
        for nome, valor in variaveis.items():
            monkeypatch.setenv(nome, valor)
        get_settings.cache_clear()
        return create_app()

    yield montar
    # Antes do monkeypatch desfazer as variáveis: a próxima leitura já sai sem elas.
    get_settings.cache_clear()


def _cliente(app: FastAPI, ip_da_conexao: str) -> TestClient:
    return TestClient(app, client=(ip_da_conexao, 50000))


def _ips_no_log(caplog) -> list[str | None]:
    return [
        json.loads(registro.getMessage())["client_ip"]
        for registro in caplog.records
        if registro.name == "algodoal.http"
    ]


# ---------------------------------------------------------------------------- log


def test_log_usa_o_ip_real_vindo_do_caddy(fabrica, caplog):
    app = fabrica(TRUSTED_PROXIES=CADDY)
    caplog.set_level(logging.INFO, logger="algodoal.http")

    resposta = _cliente(app, CADDY).get(
        "/api/v1/health", headers={"X-Forwarded-For": "200.10.20.30"}
    )

    assert resposta.status_code == 200
    assert _ips_no_log(caplog) == ["200.10.20.30"]


def test_x_forwarded_for_de_quem_nao_e_o_caddy_e_ignorado(fabrica, caplog):
    """Quem fala direto com a API não escolhe o próprio IP mandando o cabeçalho."""
    app = fabrica(TRUSTED_PROXIES=CADDY)
    caplog.set_level(logging.INFO, logger="algodoal.http")

    _cliente(app, OUTRO_CONTAINER).get("/api/v1/health", headers={"X-Forwarded-For": "1.2.3.4"})

    assert _ips_no_log(caplog) == [OUTRO_CONTAINER]


def test_sem_trusted_proxies_o_cabecalho_nao_vale(fabrica, caplog):
    app = fabrica(TRUSTED_PROXIES="")
    caplog.set_level(logging.INFO, logger="algodoal.http")

    _cliente(app, CADDY).get("/api/v1/health", headers={"X-Forwarded-For": "1.2.3.4"})

    assert _ips_no_log(caplog) == [CADDY]


def test_cadeia_de_proxies_pega_o_primeiro_ip_nao_confiavel(fabrica, caplog):
    """O Caddy acrescenta à direita; o IP do cliente é o último que não é proxy confiável."""
    app = fabrica(TRUSTED_PROXIES=f"{CADDY},10.0.0.5")
    caplog.set_level(logging.INFO, logger="algodoal.http")

    _cliente(app, CADDY).get(
        "/api/v1/health", headers={"X-Forwarded-For": "9.9.9.9, 200.10.20.30, 10.0.0.5"}
    )

    assert _ips_no_log(caplog) == ["200.10.20.30"]


# ---------------------------------------------------------------------------- rate limit


@pytest.fixture
def atras_do_caddy(fabrica, db) -> Generator[FastAPI, None, None]:
    app = fabrica(TRUSTED_PROXIES=CADDY)
    app.dependency_overrides[get_db] = lambda: db
    limiter.reset()
    yield app
    limiter.reset()


def _login(cliente: TestClient, ip: str | None = None) -> int:
    cabecalhos = {"X-Forwarded-For": ip} if ip else {}
    return cliente.post(
        "/api/v1/auth/login",
        json={"email": "ninguem-proxy@example.com", "password": "senha-errada-1"},
        headers=cabecalhos,
    ).status_code


@pytest.mark.db
@precisa_de_banco
def test_cada_cliente_atras_do_caddy_tem_o_proprio_limite(atras_do_caddy):
    """Antes, todo mundo chegava com o IP do Caddy: o sexto login da plateia travava todos."""
    caddy = _cliente(atras_do_caddy, CADDY)

    ana = [_login(caddy, "200.10.20.30") for _ in range(6)]
    bento = _login(caddy, "200.10.20.31")

    assert ana == [401, 401, 401, 401, 401, 429]
    assert bento == 401


@pytest.mark.db
@precisa_de_banco
def test_trocar_o_x_forwarded_for_sem_passar_pelo_caddy_nao_escapa_do_limite(atras_do_caddy):
    direto = _cliente(atras_do_caddy, OUTRO_CONTAINER)

    respostas = [_login(direto, f"1.1.1.{n}") for n in range(6)]

    assert respostas == [401, 401, 401, 401, 401, 429]


@pytest.mark.db
@precisa_de_banco
def test_limite_vem_da_configuracao(fabrica, db):
    app = fabrica(TRUSTED_PROXIES=CADDY, LIMITE_LOGIN="2/minute")
    app.dependency_overrides[get_db] = lambda: db
    limiter.reset()
    try:
        caddy = _cliente(app, CADDY)
        assert [_login(caddy, "200.10.20.30") for _ in range(3)] == [401, 401, 429]
    finally:
        limiter.reset()


# ---------------------------------------------------------------------------- docs


@pytest.mark.parametrize("caminho", ["/docs", "/redoc", "/api/v1/openapi.json"])
def test_docs_fora_do_ar_em_producao(fabrica, caminho):
    app = fabrica(ENVIRONMENT="production", SECRET_KEY=CHAVE_DE_PRODUCAO)

    assert TestClient(app).get(caminho).status_code == 404


def test_api_docs_liga_a_documentacao_em_producao(fabrica):
    app = fabrica(ENVIRONMENT="production", SECRET_KEY=CHAVE_DE_PRODUCAO, API_DOCS="true")

    assert TestClient(app).get("/docs").status_code == 200
    assert TestClient(app).get("/api/v1/openapi.json").status_code == 200


def test_docs_no_ar_fora_de_producao(fabrica):
    app = fabrica(ENVIRONMENT="development")

    assert TestClient(app).get("/docs").status_code == 200
