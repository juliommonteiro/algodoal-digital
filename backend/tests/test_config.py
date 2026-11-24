import pytest
from pydantic import ValidationError

from app.core.config import ConfiguracaoAusente, Settings, carregar_settings


@pytest.fixture
def sem_env_file(monkeypatch, tmp_path):
    # Roda num diretório sem .env, para só as variáveis do teste valerem.
    monkeypatch.chdir(tmp_path)


def test_database_url_nao_tem_padrao():
    assert Settings.model_fields["database_url"].is_required()


def test_sem_database_url_levanta_erro_claro(monkeypatch, sem_env_file):
    monkeypatch.delenv("DATABASE_URL", raising=False)

    with pytest.raises(ConfiguracaoAusente) as erro:
        carregar_settings()

    mensagem = str(erro.value)
    assert "DATABASE_URL" in mensagem
    assert ".env.example" in mensagem
    assert "localhost" not in mensagem


def test_database_url_vazia_conta_como_ausente(monkeypatch, sem_env_file):
    monkeypatch.setenv("DATABASE_URL", "")

    with pytest.raises(ConfiguracaoAusente, match="DATABASE_URL"):
        carregar_settings()


def test_com_database_url_carrega(monkeypatch, sem_env_file):
    monkeypatch.setenv("DATABASE_URL", "postgresql+psycopg://u:s@db:5432/x")
    assert carregar_settings().database_url.endswith("@db:5432/x")


def test_limite_de_tentativas_malformado_falha_ao_subir(monkeypatch, sem_env_file):
    monkeypatch.setenv("DATABASE_URL", "postgresql+psycopg://u:s@db:5432/x")
    monkeypatch.setenv("LIMITE_LOGIN", "trinta por minuto")

    with pytest.raises(ValidationError, match="limite inválido"):
        carregar_settings()


def test_trusted_proxies_aceita_lista_separada_por_virgula():
    settings = Settings(database_url="x", trusted_proxies=" 172.28.89.10, 10.0.0.0/8 ,")

    assert settings.trusted_proxy_list == ["172.28.89.10", "10.0.0.0/8"]
    assert Settings(database_url="x").trusted_proxy_list == []
