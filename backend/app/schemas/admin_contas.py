"""Painel admin: usuários e carroceiros."""

import uuid
from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, StringConstraints

from app.schemas.auth import Perfil
from app.schemas.carroca import Passageiros
from app.schemas.contato import WhatsApp

StatusConta = Literal["ativa", "desativada"]
StatusCarroceiro = Literal["aprovado", "suspenso"]


class UsuarioAdminRead(BaseModel):
    """Contrato: `UsuarioAdmin` em frontend/src/lib/tipos.ts. Nunca leva o hash da senha."""

    id: uuid.UUID
    name: str
    email: str
    role: Perfil
    is_active: bool
    created_at: datetime
    # Estabelecimentos que a conta administra (parceiro) e se tem perfil de carroceiro.
    estabelecimentos: int
    tem_perfil_de_carroceiro: bool


class UsuarioAdminUpdate(BaseModel):
    """PATCH /admin/users/{id}. O perfil só alterna entre turista e admin: carroceiro vem do
    cadastro e parceiro vem do e-mail do dono no estabelecimento."""

    model_config = ConfigDict(extra="forbid")

    is_active: bool | None = None
    role: Literal["tourist", "admin"] | None = None


class CarroceiroAdminRead(BaseModel):
    """Contrato: `CarroceiroAdmin`."""

    id: uuid.UUID
    user_id: uuid.UUID
    display_name: str
    email: str
    whatsapp: str | None
    capacity: int
    is_available: bool
    is_approved: bool
    conta_ativa: bool
    viagens_7_dias: int
    created_at: datetime


class CarroceiroAdminUpdate(BaseModel):
    """PATCH /admin/carriers/{id}: só o que vier muda. Suspender também tira da lista de
    disponíveis."""

    model_config = ConfigDict(extra="forbid")

    display_name: (
        Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]
        | None
    ) = None
    whatsapp: WhatsApp | None = None
    capacity: Passageiros | None = None
    is_approved: bool | None = None
