"""Schemas da carroça (#32 e #33): o pedido do turista e o painel do carroceiro."""

import uuid
from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

from app.schemas.auth import CAPACIDADE_MAXIMA
from app.schemas.contato import WhatsApp

StatusPedido = Literal["pending", "accepted", "declined", "cancelled", "expired"]
Lugar = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=160)]
Passageiros = Annotated[int, Field(ge=1, le=CAPACIDADE_MAXIMA)]


class PedidoIn(BaseModel):
    """Corpo de POST /ride-requests. Contrato: `PedidoEntrada` em frontend/src/lib/carroca.ts."""

    model_config = ConfigDict(extra="forbid")

    origin: Lugar
    destination: Lugar
    passengers: Passageiros
    # Horário e observações num campo só, como no protótipo: "Agora · duas malas grandes".
    notes: Annotated[str, StringConstraints(strip_whitespace=True, max_length=300)] | None = None
    # Do turista, para o carroceiro que aceitar: só ele vê.
    whatsapp: WhatsApp


class CarroceiroDoPedido(BaseModel):
    display_name: str
    whatsapp: str | None


class PedidoDoTurista(BaseModel):
    """Contrato: `PedidoDoTurista`. O carroceiro aparece só depois do aceite."""

    id: uuid.UUID
    origin: str
    destination: str
    passengers: int
    notes: str | None
    status: StatusPedido
    created_at: datetime
    expires_at: datetime
    responded_at: datetime | None
    carrier: CarroceiroDoPedido | None


class PedidoParaCarroceiro(BaseModel):
    """Contrato: `PedidoParaCarroceiro`. O WhatsApp do turista só vai para quem aceitou."""

    id: uuid.UUID
    origin: str
    destination: str
    passengers: int
    notes: str | None
    status: StatusPedido
    created_at: datetime
    expires_at: datetime
    responded_at: datetime | None
    tourist_name: str
    tourist_whatsapp: str | None


class PerfilCarroceiro(BaseModel):
    """Contrato: `PerfilCarroceiro`."""

    model_config = ConfigDict(from_attributes=True)

    display_name: str
    whatsapp: str | None
    capacity: int
    is_available: bool


class PerfilCarroceiroUpdate(BaseModel):
    """PATCH /carrier/me: só o que vier no corpo muda. Aprovação não é editável por aqui."""

    model_config = ConfigDict(extra="forbid")

    is_available: bool | None = None
    capacity: Passageiros | None = None
    whatsapp: WhatsApp | None = None


class ContatoCarroceiro(BaseModel):
    """GET /carriers: a lista que o turista guarda para chamar pelo WhatsApp sem internet."""

    model_config = ConfigDict(from_attributes=True)

    display_name: str
    whatsapp: str | None
    capacity: int
    is_available: bool
