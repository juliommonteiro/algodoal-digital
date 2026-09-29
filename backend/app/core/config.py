from functools import lru_cache

from pydantic import Field, ValidationError, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class ConfiguracaoAusente(RuntimeError):
    """Falta uma variável de ambiente obrigatória."""


CHAVE_DE_DESENVOLVIMENTO = "troque-isto-em-producao"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    project_name: str = "Algodoal Digital API"
    environment: str = "development"
    api_prefix: str = "/api/v1"
    # Sem padrão de propósito: um "localhost" de reserva fazia a API subir contra o banco
    # errado quando a variável faltava (dentro do container, localhost é o próprio container).
    database_url: str = Field(min_length=1)
    secret_key: str = CHAVE_DE_DESENVOLVIMENTO
    cors_origins: str = "http://localhost:5173"

    # Tokens (S5). Acesso curto; renovação longa para o turista não precisar entrar de novo
    # depois de um dia offline (docs/arquitetura.md, "Autenticação e perfis").
    access_token_minutos: int = 15
    refresh_token_dias: int = 30
    jwt_algoritmo: str = "HS256"

    @model_validator(mode="after")
    def _chave_forte_em_producao(self) -> "Settings":
        # A chave assina os tokens: com a de desenvolvimento, qualquer um forjaria um admin.
        if self.environment == "production" and (
            self.secret_key == CHAVE_DE_DESENVOLVIMENTO or len(self.secret_key) < 32
        ):
            raise ValueError(
                "SECRET_KEY de produção precisa ser trocada e ter pelo menos 32 caracteres "
                "(gere com: python -c 'import secrets; print(secrets.token_urlsafe(48))')."
            )
        return self

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
