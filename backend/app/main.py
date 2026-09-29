import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi.errors import RateLimitExceeded

from app.api.router import api_router
from app.core.config import get_settings
from app.core.limites import ao_estourar_limite, limiter

# Log da aplicação (ex.: reuso de token de renovação) com nível e origem. Os loggers do
# uvicorn têm handler próprio e não propagam, então não duplicam.
logging.basicConfig(level=logging.INFO, format="%(levelname)s [%(name)s] %(message)s")


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
    )
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, ao_estourar_limite)
    app.include_router(api_router, prefix=settings.api_prefix)
    return app


app = create_app()
