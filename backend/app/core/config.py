from functools import lru_cache

from limits import parse_many
from pydantic import Field, ValidationError, field_validator, model_validator
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
    # Fotos dos locais (#29): pasta local, servida em {api_prefix}/media. Relativa ao diretório
    # de onde a API roda (no Docker, /app/media = backend/media no seu computador). Decisão 7
    # da arquitetura: local em dev, atrás de app/core/storage.py.
    media_dir: str = "media"

    # Tokens (S5). Acesso curto; renovação longa para o turista não precisar entrar de novo
    # depois de um dia offline (docs/arquitetura.md, "Autenticação e perfis").
    access_token_minutos: int = 15
    refresh_token_dias: int = 30
    # Reapresentar um token de renovação trocado há menos que isto devolve o par que o
    # substituiu, em vez de contar como reuso: duas abas renovando juntas é corrida, não ataque.
    refresh_janela_de_graca_segundos: int = Field(default=30, ge=0)
    jwt_algoritmo: str = "HS256"

    # Tentativas por IP (app/core/limites.py), no formato do slowapi ("5/minute"). Em produção
    # o .env.prod sobe estes números: a plateia de uma apresentação sai toda pelo mesmo IP do
    # Wi-Fi do evento (ou da operadora, no 4G).
    limite_login: str = "5/minute"
    limite_registro: str = "3/minute"
    # IPs (ou redes, ex. 172.28.89.0/24) dos proxies cujo X-Forwarded-For vale como IP do
    # cliente. Vazio: não confia em ninguém, e o IP é o da conexão. Em produção é o do Caddy
    # (compose.prod.yml); fora dele, um X-Forwarded-For deixaria qualquer um escolher o próprio
    # IP e escapar do limite de tentativas.
    trusted_proxies: str = ""
    # /docs e /api/v1/openapi.json. Sem valor: ligados, menos em produção.
    api_docs: bool | None = None

    @field_validator("limite_login", "limite_registro")
    @classmethod
    def _limite_valido(cls, valor: str) -> str:
        # Falha ao subir, e não no primeiro login, se o .env.prod trouxer um limite malformado.
        try:
            parse_many(valor)
        except ValueError as exc:
            raise ValueError(f"limite inválido: {valor!r} (use, por exemplo, 30/minute)") from exc
        return valor

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

    @property
    def trusted_proxy_list(self) -> list[str]:
        return [p.strip() for p in self.trusted_proxies.split(",") if p.strip()]

    @property
    def docs_habilitados(self) -> bool:
        if self.api_docs is not None:
            return self.api_docs
        return self.environment != "production"


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
