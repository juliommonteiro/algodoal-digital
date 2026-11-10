"""Indicadores do piloto no painel admin (#40, protótipo 13, PRD §18)."""

import uuid
from datetime import datetime

from pydantic import BaseModel

from app.schemas.carroca import StatusPedido


class IndicadoresUsuarios(BaseModel):
    total: int
    # Entraram (abriram sessão ou renovaram) nos últimos 30 dias.
    ativos_30_dias: int
    turistas: int
    carroceiros: int
    parceiros: int
    admins: int


class IndicadoresLocais(BaseModel):
    publicados: int
    rascunhos: int
    removidos: int
    estabelecimentos: int
    estabelecimentos_com_dono: int
    com_foto: int


class IndicadoresCarroceiros(BaseModel):
    total: int
    disponiveis: int


class IndicadoresPedidos(BaseModel):
    total: int
    ultimos_7_dias: int
    aceitos_7_dias: int
    # Aceitos ÷ (aceitos + vencidos) nos 7 dias: cancelado pelo turista não conta contra.
    taxa_de_aceite_7_dias: float | None
    # Do pedido ao aceite, nos aceitos dos 7 dias.
    minutos_ate_aceite_7_dias: float | None


class PedidoDeHoje(BaseModel):
    id: uuid.UUID
    origin: str
    destination: str
    passengers: int
    status: StatusPedido
    created_at: datetime


class Indicadores(BaseModel):
    """Contrato: `Indicadores` em frontend/src/lib/tipos.ts."""

    gerado_em: datetime
    usuarios: IndicadoresUsuarios
    locais: IndicadoresLocais
    carroceiros: IndicadoresCarroceiros
    pedidos: IndicadoresPedidos
    pedidos_de_hoje: list[PedidoDeHoje]
