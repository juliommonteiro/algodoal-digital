import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import requer_perfil
from app.db.session import get_db
from app.models import Place
from app.schemas.admin import PlaceAdminRead, PlaceCreate, PlaceUpdate, StatusAdmin
from app.schemas.category import CategoryRead
from app.schemas.place import PlaceKind
from app.services import admin_catalog, catalog

# O perfil é exigido no router inteiro: rota nova aqui não nasce desprotegida.
# Sem token: 401; com token de outro perfil: 403.
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
_404 = {status.HTTP_404_NOT_FOUND: {"description": "Local não encontrado"}}


def _ler(local: Place) -> PlaceAdminRead:
    return PlaceAdminRead.model_validate(local)


def _local(db: Session, place_id: uuid.UUID) -> Place:
    try:
        return admin_catalog.obter_local(db, place_id)
    except admin_catalog.LocalNaoEncontrado as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Local não encontrado.") from exc


def _categoria_inexistente() -> HTTPException:
    # Mesmo formato do erro de validação do FastAPI: o painel marca o campo certo.
    return HTTPException(
        status.HTTP_422_UNPROCESSABLE_CONTENT,
        detail=[
            {
                "loc": ["body", "category_id"],
                "msg": "Categoria inexistente.",
                "type": "categoria_inexistente",
            }
        ],
    )


@router.get("/places", summary="Todos os locais, inclusive não publicados e removidos")
def listar_locais(
    db: Db,
    category: Annotated[str | None, Query(description="Slug; inclui subcategorias.")] = None,
    kind: PlaceKind | None = None,
    status_: Annotated[StatusAdmin | None, Query(alias="status")] = None,
    q: Annotated[str | None, Query(description="Parte do nome.", max_length=160)] = None,
) -> list[PlaceAdminRead]:
    locais = admin_catalog.listar_locais(db, category=category, kind=kind, status=status_, busca=q)
    return [_ler(local) for local in locais]


@router.post("/places", status_code=status.HTTP_201_CREATED, summary="Cria um local")
def criar_local(dados: PlaceCreate, db: Db) -> PlaceAdminRead:
    try:
        return _ler(admin_catalog.criar_local(db, dados))
    except admin_catalog.CategoriaInexistente as exc:
        raise _categoria_inexistente() from exc


@router.get("/places/{place_id}", summary="Detalhe, mesmo de não publicado", responses=_404)
def obter_local(place_id: uuid.UUID, db: Db) -> PlaceAdminRead:
    return _ler(_local(db, place_id))


@router.patch("/places/{place_id}", summary="Edita o local e o negócio", responses=_404)
def atualizar_local(place_id: uuid.UUID, dados: PlaceUpdate, db: Db) -> PlaceAdminRead:
    _local(db, place_id)
    try:
        return _ler(admin_catalog.atualizar_local(db, place_id, dados))
    except admin_catalog.CategoriaInexistente as exc:
        raise _categoria_inexistente() from exc


@router.delete("/places/{place_id}", summary="Remoção lógica (preenche deleted_at)", responses=_404)
def remover_local(place_id: uuid.UUID, db: Db) -> PlaceAdminRead:
    _local(db, place_id)
    return _ler(admin_catalog.remover_local(db, place_id))


@router.post("/places/{place_id}/restaurar", summary="Desfaz a remoção", responses=_404)
def restaurar_local(place_id: uuid.UUID, db: Db) -> PlaceAdminRead:
    _local(db, place_id)
    return _ler(admin_catalog.restaurar_local(db, place_id))


@router.get("/categories", summary="Categorias, para os seletores do painel")
def listar_categorias(db: Db) -> list[CategoryRead]:
    return [CategoryRead.model_validate(c) for c in catalog.listar_categorias(db)]
