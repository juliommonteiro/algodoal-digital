from functools import lru_cache

from pydantic import Field, ValidationError
from pydantic_settings import BaseSettings, SettingsConfigDict


class ConfiguracaoAusente(RuntimeError):
    """Falta uma variável de ambiente obrigatória."""


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    project_name: str = "Algodoal Digital API"
    environment: str = "development"
    api_prefix: str = "/api/v1"
    # Sem padrão de propósito: um "localhost" de reserva fazia a API subir contra o banco
    # errado quando a variável faltava (dentro do container, localhost é o próprio container).
    database_url: str = Field(min_length=1)
    secret_key: str = "troque-isto-em-producao"
    cors_origins: str = "http://localhost:5173"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


def carregar_settings() -> Settings:
    """Lê a configuração; variável obrigatória ausente vira um erro que diz qual e o que fazer."""
    try:
        return Settings()
    except ValidationError as exc:
        # "missing" = não definida; "string_too_short" = definida vazia (DATABASE_URL=)
        faltando = [
            str(erro["loc"][0]).upper()
            for erro in exc.errors()
            if erro["type"] in ("missing", "string_too_short")
        ]
        if not faltando:
            raise
        raise ConfiguracaoAusente(
            f"Variável de ambiente obrigatória ausente: {', '.join(faltando)}. "
            "Copie o .env.example para .env na raiz do projeto (cp .env.example .env) "
            "e confira os valores; com Docker Compose, o serviço api lê esse arquivo."
        ) from None


@lru_cache
def get_settings() -> Settings:
    return carregar_settings()
