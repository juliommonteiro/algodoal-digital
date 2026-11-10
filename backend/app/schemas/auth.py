import re
import uuid
from typing import Annotated, Literal, get_args

from pydantic import BaseModel, ConfigDict, EmailStr, Field, StringConstraints, field_validator
from pydantic_core import PydanticCustomError

from app.models.user import USER_ROLES

SENHA_MINIMA = 8
# Argon2 aceita qualquer tamanho, mas senha de megabytes vira ataque de CPU.
SENHA_MAXIMA = 128
# Pessoas por viagem que o carroceiro declara no cadastro.
CAPACIDADE_MAXIMA = 12

Perfil = Literal["tourist", "carrier", "partner", "admin"]
assert set(get_args(Perfil)) == set(USER_ROLES), "Perfil fora de sincronia com o model"


class CarroceiroIn(BaseModel):
    """Perfil de carroceiro criado junto com a conta. Não passa por aprovação: quem se cadastra
    como carroceiro já entra com o perfil ativo (decisão da equipe, sem lista fechada)."""

    model_config = ConfigDict(extra="forbid")

    whatsapp: Annotated[str, StringConstraints(strip_whitespace=True, max_length=30)]
    capacity: Annotated[int, Field(ge=1, le=CAPACIDADE_MAXIMA)] = 2

    @field_validator("whatsapp")
    @classmethod
    def _whatsapp(cls, valor: str) -> str:
        # Com DDD (10 ou 11 dígitos) ou já com o 55 do Brasil: é o que o link wa.me aceita.
        digitos = re.sub(r"\D", "", valor)
        if not (len(digitos) in (10, 11) or (len(digitos) in (12, 13) and digitos[:2] == "55")):
            raise PydanticCustomError(
                "whatsapp_invalido", "Informe o WhatsApp com DDD, por exemplo (91) 98888-7777."
            )
        return valor


class RegistroIn(BaseModel):
    """Corpo de POST /auth/register, como o PWA envia: {name, email, password} e, para quem se
    cadastra como carroceiro, `carrier`. O perfil nunca vem do corpo: sem `carrier` é turista,
    com `carrier` é carroceiro. Um "role" no corpo é ignorado."""

    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]
    email: EmailStr
    # Senha nunca passa por strip: espaço é caractere válido.
    password: Annotated[str, Field(min_length=SENHA_MINIMA, max_length=SENHA_MAXIMA)]
    carrier: CarroceiroIn | None = None


class LoginIn(BaseModel):
    email: EmailStr
    # Sem mínimo de 8 aqui: senha curta é só uma senha errada, e responde igual (401).
    password: Annotated[str, Field(min_length=1, max_length=SENHA_MAXIMA)]


class RefreshIn(BaseModel):
    """Corpo de POST /auth/refresh e POST /auth/logout."""

    refresh_token: Annotated[str, Field(min_length=1, max_length=4096)]


class UsuarioRead(BaseModel):
    """Contrato: `Usuario` em frontend/src/lib/tipos.ts. O hash da senha nunca sai."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    email: str
    role: Perfil


class RespostaLogin(BaseModel):
    """Contrato: `RespostaLogin`."""

    access_token: str
    refresh_token: str
    token_type: Literal["bearer"] = "bearer"
    user: UsuarioRead
