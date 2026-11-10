"""Painel do parceiro (#26): o dono, ligado pelo admin (owner_email), edita o que é dele."""

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models import Business, Place, User
from app.schemas.parceiro import NegocioDoParceiroUpdate

# O que o parceiro pode mudar e onde fica: no local ou nos dados comerciais.
CAMPOS_DO_LOCAL = ("description", "is_published")
CAMPOS_DO_NEGOCIO = ("whatsapp", "phone", "opening_hours", "price_range", "services")


class NegocioNaoEncontrado(Exception):
    """Não existe, foi removido ou é de outra pessoa: para o parceiro, tudo igual (404)."""


def _dele(dono: User):
    return (
        select(Place)
        .join(Place.business)
        .where(Business.owner_id == dono.id, Place.deleted_at.is_(None))
        .options(selectinload(Place.business), selectinload(Place.photos))
    )


def listar(db: Session, dono: User) -> list[Place]:
    return list(db.scalars(_dele(dono).order_by(Place.name)))


def obter(db: Session, dono: User, place_id: uuid.UUID) -> Place:
    local = db.scalar(_dele(dono).where(Place.id == place_id))
    if local is None:
        raise NegocioNaoEncontrado
    return local


def atualizar(
    db: Session, dono: User, place_id: uuid.UUID, dados: NegocioDoParceiroUpdate
) -> Place:
    local = obter(db, dono, place_id)
    enviados = dados.model_fields_set
    for campo in CAMPOS_DO_LOCAL:
        if campo in enviados:
            valor = getattr(dados, campo)
            # is_published é NOT NULL: null no corpo não desliga, só é ignorado.
            if campo == "is_published" and valor is None:
                continue
            setattr(local, campo, valor)
    for campo in CAMPOS_DO_NEGOCIO:
        if campo in enviados:
            valor = getattr(dados, campo)
            if campo == "services":
                valor = list(valor or [])
            elif campo == "opening_hours" and valor:
                valor = {dia: [list(faixa) for faixa in faixas] for dia, faixas in valor.items()}
            setattr(local.business, campo, valor)
    db.commit()
    db.refresh(local)
    return local
