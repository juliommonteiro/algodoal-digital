import json
import logging
import re
import time
import uuid

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi.errors import RateLimitExceeded

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


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title=settings.project_name,
        version="0.1.0",
        docs_url="/docs",
        openapi_url=f"{settings.api_prefix}/openapi.json",
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
                    "method": request.method,
                    "path": request.url.path,
                    "status": response.status_code,
                    "duration_ms": duracao_ms,
                },
                ensure_ascii=False,
            )
        )
        return response

    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, ao_estourar_limite)
    app.include_router(api_router, prefix=settings.api_prefix)
    return app


app = create_app()
