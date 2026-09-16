from fastapi import APIRouter

from app.api.routes import health

api_router = APIRouter()
api_router.include_router(health.router)
# S5: api_router.include_router(places.router, prefix="/places")
