from fastapi import APIRouter

from app.api.routes import categories, health, places

api_router = APIRouter()
api_router.include_router(health.router)
# Catálogo público: consultar mapa e diretório não exige conta (PRD, seção 10).
api_router.include_router(categories.router)
api_router.include_router(places.router)
