"""Rate limiting (PRD, seção 22): trava tentativa de senha por força bruta e cadastro em massa.

Contagem em memória, por IP e por processo: com N workers do uvicorn (produção roda 2), cada um
conta separado e o limite efetivo fica até N vezes maior. Com várias máquinas, o storage_uri
precisa apontar para um Redis.

O IP é o de `request.client`. Atrás do Caddy (compose.prod.yml), quem o troca pelo IP real do
X-Forwarded-For é o middleware de proxy do create_app, que só confia nos endereços de
TRUSTED_PROXIES. Sem isso, todo mundo chegaria com o IP do Caddy e seria bloqueado junto.
"""

from fastapi import Request
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.core.config import get_settings

limiter = Limiter(key_func=get_remote_address)


# Funções, e não constantes: o slowapi as chama a cada requisição, então o valor vem da
# configuração (LIMITE_LOGIN e LIMITE_REGISTRO) sem precisar dela no import.
def limite_login() -> str:
    return get_settings().limite_login


def limite_registro() -> str:
    return get_settings().limite_registro


def ao_estourar_limite(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    return JSONResponse(
        status_code=429,
        content={"detail": "Muitas tentativas. Espere um minuto e tente de novo."},
        headers={"Retry-After": "60"},
    )
