import uuid
from typing import Annotated, Literal, get_args

from pydantic import BaseModel, ConfigDict, EmailStr, Field, StringConstraints

from app.models.user import USER_ROLES

SENHA_MINIMA = 8
# Argon2 aceita qualquer tamanho, mas senha de megabytes vira ataque de CPU.
SENHA_MAXIMA = 128

Perfil = Literal["tourist", "carrier", "partner", "admin"]
assert set(get_args(Perfil)) == set(USER_ROLES), "Perfil fora de sincronia com o model"


class RegistroIn(BaseModel):
    """Corpo de POST /auth/register, como o PWA envia: {name, email, password}."""

    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]
    email: EmailStr
    # Senha nunca passa por strip: espaço é caractere válido.
    password: Annotated[str, Field(min_length=SENHA_MINIMA, max_length=SENHA_MAXIMA)]


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
