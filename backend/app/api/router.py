from fastapi import APIRouter

from app.api.routes import (
    admin,
    admin_contas,
    auth,
    carroca,
    categories,
    health,
    parceiro,
    places,
    sync,
)

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router)
# Catálogo público: consultar mapa e diretório não exige conta (PRD, seção 10).
api_router.include_router(categories.router)
api_router.include_router(places.router)
# Pull do catálogo para o IndexedDB do celular (#28): também público.
api_router.include_router(sync.router)
# Painel administrativo (S6): só perfil admin.
api_router.include_router(admin.router)
api_router.include_router(admin_contas.router)
# Carroça (S10): pedido do turista (com sessão) e painel do carroceiro (só perfil carrier).
api_router.include_router(carroca.pedidos)
api_router.include_router(carroca.contatos)
api_router.include_router(carroca.painel)
# Painel do parceiro (#26): o dono edita o próprio estabelecimento.
api_router.include_router(parceiro.router)
