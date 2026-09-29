"""Catálogo público: categorias e locais, só leitura (escrita é do painel admin, S6)."""

import uuid

from sqlalchemy import CTE, Select, select
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
