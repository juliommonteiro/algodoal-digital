"""Catálogo público: categorias e locais, só leitura (escrita é do painel admin, S6)."""

import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta

from sqlalchemy import CTE, Select, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.models import Category, Place


def listar_categorias(db: Session) -> list[Category]:
    """Todas as categorias, planas, com parent_id. Quem monta a árvore é o cliente."""
    return list(db.scalars(select(Category).order_by(Category.sort_order, Category.name)))


def arvore_da_categoria(slug: str) -> CTE:
    """Ids da categoria `slug` e de todos os descendentes, numa CTE recursiva.

    WITH RECURSIVE arvore(id) AS (
        SELECT id FROM categories WHERE slug = :slug
        UNION
        SELECT c.id FROM categories c JOIN arvore a ON c.parent_id = a.id
    )

    UNION, e não UNION ALL: se um dia a hierarquia ganhar um ciclo (A -> B -> A, possível
    quando o admin da S6 editar categorias), o UNION descarta a linha repetida e a recursão
    para; com UNION ALL ela não terminaria.
    """
    arvore = select(Category.id).where(Category.slug == slug).cte("arvore", recursive=True)
    anterior = arvore.alias("anterior")
    filhas = select(Category.id).join(anterior, Category.parent_id == anterior.c.id)
    return arvore.union(filhas)


def _visiveis() -> Select[tuple[Place]]:
    # Regra de toda consulta pública: publicado e não removido (soft delete).
    return select(Place).where(Place.is_published.is_(True), Place.deleted_at.is_(None))


def _com_negocio_e_fotos(consulta: Select[tuple[Place]]) -> Select[tuple[Place]]:
    # selectinload: uma consulta para todos os negócios e uma para todas as fotos,
    # qualquer que seja o número de locais (sem N+1). As fotos já vêm por `position`.
    return consulta.options(selectinload(Place.business), selectinload(Place.photos))


def listar_locais(
    db: Session, *, category: str | None = None, kind: str | None = None
) -> list[Place]:
    """Locais publicados, por nome.

    `category` é o slug e inclui os descendentes: os locais apontam para a categoria mais
    específica (restaurantes), mas os filtros da interface são as mães (alimentacao). Um
    filtro literal por category_id devolveria lista vazia sem erro nenhum.
    Slug inexistente dá lista vazia: é filtro, não recurso. Os filtros combinam com E.
    """
    consulta = _visiveis()
    if category is not None:
        arvore = arvore_da_categoria(category)
        consulta = consulta.where(Place.category_id.in_(select(arvore.c.id)))
    if kind is not None:
        consulta = consulta.where(Place.kind == kind)
    consulta = _com_negocio_e_fotos(consulta).order_by(Place.name, Place.id)
    return list(db.scalars(consulta))


def obter_local(db: Session, place_id: uuid.UUID) -> Place | None:
    """Um local publicado, com negócio e fotos; None se não existe, não publicado ou removido."""
    return db.scalar(_com_negocio_e_fotos(_visiveis().where(Place.id == place_id)))


# Volta este tanto antes do `since`: uma gravação que começou antes da última consulta e terminou
# depois dela tem updated_at anterior ao server_time devolvido. Reaplicar o que não mudou não faz
# mal no celular (upsert por id).
MARGEM_DO_SYNC = timedelta(minutes=1)


@dataclass
class MudancasDoCatalogo:
    server_time: datetime
    full: bool
    categorias: list[Category]
    locais: list[Place]
    removidos: list[uuid.UUID]


def mudancas_do_catalogo(db: Session, since: datetime | None) -> MudancasDoCatalogo:
    """Sem `since`, o catálogo público inteiro. Com `since`, os publicados alterados desde então
    e os ids dos que saíram do público (removidos ou despublicados) no mesmo período.

    "Alterado" inclui negócio e fotos: os triggers da migração a33968362746 tocam o local.
    """
    # Hora do banco, não do servidor da API: é com ela que o updated_at foi gravado.
    server_time = db.scalar(select(func.now()))
    categorias = listar_categorias(db)
    if since is None:
        return MudancasDoCatalogo(server_time, True, categorias, listar_locais(db), [])
    corte = since - MARGEM_DO_SYNC
    alterados = _com_negocio_e_fotos(_visiveis().where(Place.updated_at > corte))
    saidos = select(Place.id).where(
        Place.updated_at > corte,
        or_(Place.is_published.is_(False), Place.deleted_at.is_not(None)),
    )
    return MudancasDoCatalogo(
        server_time,
        False,
        categorias,
        list(db.scalars(alterados.order_by(Place.name, Place.id))),
        list(db.scalars(saidos)),
    )
