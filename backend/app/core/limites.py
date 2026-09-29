"""Rate limiting (PRD, seção 22): trava tentativa de senha por força bruta e cadastro em massa.

Contagem em memória, por IP. Vale enquanto a API roda num processo só; com várias réplicas
(S12-S13, AWS), cada uma contaria separado — aí o storage_uri precisa apontar para um Redis.
Atrás de proxy, o IP que chega é o do proxy: configurar o uvicorn com --proxy-headers.
"""

from fastapi import Request
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

LIMITE_LOGIN = "5/minute"
LIMITE_REGISTRO = "3/minute"

limiter = Limiter(key_func=get_remote_address)


def ao_estourar_limite(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    return JSONResponse(
        status_code=429,
        content={"detail": "Muitas tentativas. Espere um minuto e tente de novo."},
        headers={"Retry-After": "60"},
    )
