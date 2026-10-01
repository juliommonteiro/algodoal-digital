"""Painel administrativo: o catálogo inteiro, inclusive o que o público não vê, e a escrita.

Remover é lógico (deleted_at), para o pull do catálogo (S8) poder avisar o celular que o local
saiu. Local criado aqui é dado real (source='campo'): o `seed --reset` nunca o apaga.
"""

import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models import Business, Category, Place
from app.schemas.admin import BusinessWrite, PlaceCreate, PlaceUpdate, StatusAdmin
from app.services.catalog import arvore_da_categoria

ORIGEM_DO_PAINEL = "campo"


class LocalNaoEncontrado(Exception):
    pass


class CategoriaInexistente(Exception):
    pass


def listar_locais(
    db: Session,
    *,
    category: str | None = None,
    kind: str | None = None,
    status: StatusAdmin | None = None,
    busca: str | None = None,
) -> list[Place]:
    """Todos os locais — publicados, rascunhos e removidos —, por nome. `category` é o slug e
    inclui as subcategorias, como na rota pública."""
    consulta = select(Place)
    if category:
        arvore = arvore_da_categoria(category)
        consulta = consulta.where(Place.category_id.in_(select(arvore.c.id)))
    if kind:
        consulta = consulta.where(Place.kind == kind)
    if status == "removido":
        consulta = consulta.where(Place.deleted_at.is_not(None))
    elif status == "publicado":
        consulta = consulta.where(Place.deleted_at.is_(None), Place.is_published.is_(True))
    elif status == "rascunho":
        consulta = consulta.where(Place.deleted_at.is_(None), Place.is_published.is_(False))
    if busca and busca.strip():
        termo = busca.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        consulta = consulta.where(Place.name.ilike(f"%{termo}%", escape="\\"))
    consulta = consulta.options(selectinload(Place.business), selectinload(Place.photos))
    return list(db.scalars(consulta.order_by(Place.name, Place.id)))


def obter_local(db: Session, place_id: uuid.UUID) -> Place:
    """Qualquer local, inclusive não publicado ou removido."""
    local = db.get(Place, place_id)
    if local is None:
        raise LocalNaoEncontrado
    return local


def _garantir_categoria(db: Session, category_id: uuid.UUID) -> None:
    if db.get(Category, category_id) is None:
        raise CategoriaInexistente


def _aplicar_negocio(local: Place, dados: BusinessWrite | None) -> None:
    """None remove os dados comerciais; um objeto os cria ou substitui por inteiro."""
    if dados is None:
        local.business = None
        return
    valores = {
        "whatsapp": dados.whatsapp,
        "phone": dados.phone,
        # tuplas do schema viram listas no JSONB
        "opening_hours": (
            {dia: [list(faixa) for faixa in faixas] for dia, faixas in dados.opening_hours.items()}
            if dados.opening_hours
            else None
        ),
        "price_range": dados.price_range,
        "services": list(dados.services),
        "is_partner": dados.is_partner,
    }
    if local.business is None:
        local.business = Business(source=ORIGEM_DO_PAINEL, **valores)
    else:
        for campo, valor in valores.items():
            setattr(local.business, campo, valor)


def criar_local(db: Session, dados: PlaceCreate) -> Place:
    _garantir_categoria(db, dados.category_id)
    local = Place(
        name=dados.name,
        description=dados.description,
        kind=dados.kind,
        category_id=dados.category_id,
        latitude=dados.latitude,
        longitude=dados.longitude,
        is_published=dados.is_published,
        source=ORIGEM_DO_PAINEL,
    )
    if dados.business is not None:
        _aplicar_negocio(local, dados.business)
    db.add(local)
    db.commit()
    db.refresh(local)
    return local


def atualizar_local(db: Session, place_id: uuid.UUID, dados: PlaceUpdate) -> Place:
    local = obter_local(db, place_id)
    enviados = dados.model_fields_set
    if "category_id" in enviados:
        _garantir_categoria(db, dados.category_id)
    for campo in ("name", "description", "kind", "category_id", "latitude", "longitude"):
        if campo in enviados:
            setattr(local, campo, getattr(dados, campo))
    if "is_published" in enviados:
        local.is_published = dados.is_published
    if "business" in enviados:
        _aplicar_negocio(local, dados.business)
    db.commit()
    db.refresh(local)
    return local


def remover_local(db: Session, place_id: uuid.UUID) -> Place:
    """Remoção lógica: preenche deleted_at; nada sai do banco. Remover de novo não muda a data."""
    local = obter_local(db, place_id)
    if local.deleted_at is None:
        local.deleted_at = datetime.now(UTC)
        db.commit()
        db.refresh(local)
    return local


def restaurar_local(db: Session, place_id: uuid.UUID) -> Place:
    local = obter_local(db, place_id)
    if local.deleted_at is not None:
        local.deleted_at = None
        db.commit()
        db.refresh(local)
    return local
