import json
import logging
import re
import time
import uuid

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi.errors import RateLimitExceeded
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware

from app.api.router import api_router
from app.core.config import get_settings
from app.core.limites import ao_estourar_limite, limiter

# Log da aplicação (ex.: reuso de token de renovação) com nível e origem. Os loggers do
# uvicorn têm handler próprio e não propagam, então não duplicam.
logging.basicConfig(level=logging.INFO, format="%(levelname)s [%(name)s] %(message)s")
logger_http = logging.getLogger("algodoal.http")
REQUEST_ID_VALIDO = re.compile(r"^[A-Za-z0-9._:-]{1,128}$")


def _request_id(request: Request) -> str:
    recebido = request.headers.get("x-request-id", "")
    if recebido and REQUEST_ID_VALIDO.fullmatch(recebido):
        return recebido
    return str(uuid.uuid4())


def _ip_do_cliente(request: Request) -> str | None:
    return request.client.host if request.client else None


def create_app() -> FastAPI:
    settings = get_settings()
    # Em produção a documentação sai do ar (API_DOCS=true liga de novo): ela entrega o mapa de
    # todas as rotas, inclusive as do admin.
    docs = settings.docs_habilitados
    app = FastAPI(
        title=settings.project_name,
        version="0.1.0",
        docs_url="/docs" if docs else None,
        redoc_url="/redoc" if docs else None,
        openapi_url=f"{settings.api_prefix}/openapi.json" if docs else None,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["X-Request-ID"],
    )

    @app.middleware("http")
    async def observabilidade_http(request: Request, call_next):
        request_id = _request_id(request)
        request.state.request_id = request_id
        inicio = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception:
            duracao_ms = round((time.perf_counter() - inicio) * 1000, 2)
            logger_http.exception(
                json.dumps(
                    {
                        "event": "http_request_failed",
                        "request_id": request_id,
                        "client_ip": _ip_do_cliente(request),
                        "method": request.method,
                        "path": request.url.path,
                        "duration_ms": duracao_ms,
                    },
                    ensure_ascii=False,
                )
            )
            raise
        duracao_ms = round((time.perf_counter() - inicio) * 1000, 2)
        response.headers["X-Request-ID"] = request_id
        logger_http.info(
            json.dumps(
                {
                    "event": "http_request_complete",
                    "request_id": request_id,
                    "client_ip": _ip_do_cliente(request),
                    "method": request.method,
                    "path": request.url.path,
                    "status": response.status_code,
                    "duration_ms": duracao_ms,
                },
                ensure_ascii=False,
            )
        )
        return response

    # Fotos dos locais (#29). check_dir=False: a pasta nasce no primeiro upload.
    app.mount(
        f"{settings.api_prefix}/media",
        StaticFiles(directory=settings.media_dir, check_dir=False),
        name="media",
    )
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, ao_estourar_limite)
    app.include_router(api_router, prefix=settings.api_prefix)

    # IP real atrás do Caddy (compose.prod.yml): só a conexão vinda de um endereço de
    # TRUSTED_PROXIES tem o X-Forwarded-For (e o X-Forwarded-Proto) aceito. Adicionado por
    # último para ficar por fora de todos: o rate limit, o CORS e o log acima já veem o IP do
    # cliente. Vazio (desenvolvimento): este middleware não entra.
    if settings.trusted_proxy_list:
        app.add_middleware(ProxyHeadersMiddleware, trusted_hosts=settings.trusted_proxy_list)
    return app


app = create_app()
