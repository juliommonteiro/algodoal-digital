"""Painel admin: usuários e carroceiros."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import requer_perfil
from app.db.session import get_db
from app.models import User
from app.schemas.admin_contas import (
    CarroceiroAdminRead,
    CarroceiroAdminUpdate,
    StatusCarroceiro,
    StatusConta,
    UsuarioAdminRead,
    UsuarioAdminUpdate,
)
from app.schemas.auth import Perfil
from app.services import admin_contas

# Mesmo esquema do /admin: o perfil é exigido no router inteiro.
router = APIRouter(
    prefix="/admin",
    tags=["admin"],
    dependencies=[Depends(requer_perfil("admin"))],
    responses={
        status.HTTP_401_UNAUTHORIZED: {"description": "Não autenticado"},
        status.HTTP_403_FORBIDDEN: {"description": "Perfil sem acesso"},
    },
)

Db = Annotated[Session, Depends(get_db)]
Admin = Annotated[User, Depends(requer_perfil("admin"))]
Busca = Annotated[
    str | None, Query(description="Parte do nome, e-mail ou WhatsApp.", max_length=160)
]

PERFIL = {"carrier": "carroceiro", "partner": "parceiro"}


def _erro(codigo: int, detalhe: str) -> HTTPException:
    return HTTPException(status_code=codigo, detail=detalhe)


@router.get("/users", summary="Usuários, com filtros por perfil, situação e busca")
def listar_usuarios(
    db: Db,
    perfil: Perfil | None = None,
    status_: Annotated[StatusConta | None, Query(alias="status")] = None,
    q: Busca = None,
) -> list[UsuarioAdminRead]:
    return admin_contas.listar_usuarios(db, perfil=perfil, status=status_, busca=q)


@router.patch(
    "/users/{user_id}",
    summary="Desativa/reativa a conta ou alterna entre turista e admin",
    responses={404: {"description": "Usuário não encontrado"}, 409: {"description": "Trava"}},
)
def atualizar_usuario(
    user_id: uuid.UUID, dados: UsuarioAdminUpdate, admin: Admin, db: Db
) -> UsuarioAdminRead:
    try:
        return admin_contas.atualizar_usuario(db, admin, user_id, dados)
    except admin_contas.ContaNaoEncontrada as exc:
        raise _erro(status.HTTP_404_NOT_FOUND, "Usuário não encontrado.") from exc
    except admin_contas.PropriaConta as exc:
        raise _erro(
            status.HTTP_409_CONFLICT,
            "Você não pode mudar a própria conta por aqui: peça a outro admin.",
        ) from exc
    except admin_contas.PerfilDoCadastro as exc:
        origem = (
            "do cadastro de carroceiro (suspenda em Carroceiros)"
            if exc.perfil == "carrier"
            else "do e-mail do dono no estabelecimento (mude em Locais)"
        )
        raise _erro(
            status.HTTP_409_CONFLICT,
            f"O perfil de {PERFIL[exc.perfil]} vem {origem}, não se troca aqui.",
        ) from exc


@router.get("/carriers", summary="Carroceiros, com filtro de situação e busca")
def listar_carroceiros(
    db: Db,
    status_: Annotated[StatusCarroceiro | None, Query(alias="status")] = None,
    q: Busca = None,
) -> list[CarroceiroAdminRead]:
    return admin_contas.listar_carroceiros(db, status=status_, busca=q)


@router.patch(
    "/carriers/{carrier_id}",
    summary="Edita nome, WhatsApp e capacidade, ou suspende/reativa",
    responses={404: {"description": "Carroceiro não encontrado"}},
)
def atualizar_carroceiro(
    carrier_id: uuid.UUID, dados: CarroceiroAdminUpdate, db: Db
) -> CarroceiroAdminRead:
    try:
        return admin_contas.atualizar_carroceiro(db, carrier_id, dados)
    except admin_contas.ContaNaoEncontrada as exc:
        raise _erro(status.HTTP_404_NOT_FOUND, "Carroceiro não encontrado.") from exc
