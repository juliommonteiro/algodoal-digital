"""Rotas de fotos (#29), as mesmas no /admin e no /partner: muda só quem pode mexer em qual
local, decidido pela dependência `local_permitido` de cada painel.

A imagem vem como corpo bruto (Content-Type image/jpeg, image/png ou image/webp), sem
multipart: o app reduz e reenvia a foto como JPEG, e o tipo é conferido pelos bytes.
"""

import uuid
from collections.abc import Callable
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from app.core import storage
from app.db.session import get_db
from app.models import Place
from app.schemas.place import PhotoRead
from app.services import fotos

_ERROS = {
    status.HTTP_404_NOT_FOUND: {"description": "Local ou foto não encontrado"},
    status.HTTP_409_CONFLICT: {"description": f"Já tem {fotos.LIMITE_POR_LOCAL} fotos"},
    status.HTTP_413_CONTENT_TOO_LARGE: {"description": "Foto maior que 5 MB"},
    status.HTTP_415_UNSUPPORTED_MEDIA_TYPE: {"description": "Não é JPG, PNG nem WebP"},
}


def _erro(codigo: int, detalhe: str) -> HTTPException:
    return HTTPException(status_code=codigo, detail=detalhe)


def _grande_demais() -> HTTPException:
    return _erro(status.HTTP_413_CONTENT_TOO_LARGE, "A foto passa de 5 MB. Tente uma menor.")


async def _ler_imagem(request: Request) -> bytes:
    """Lê o corpo sem passar do limite, mesmo sem Content-Length."""
    tamanho = request.headers.get("content-length")
    if tamanho and tamanho.isdigit() and int(tamanho) > fotos.TAMANHO_MAXIMO:
        raise _grande_demais()
    corpo = bytearray()
    async for parte in request.stream():
        corpo += parte
        if len(corpo) > fotos.TAMANHO_MAXIMO:
            raise _grande_demais()
    return bytes(corpo)


def _lista(local: Place) -> list[PhotoRead]:
    return [PhotoRead.model_validate(f) for f in sorted(local.photos, key=lambda f: f.position)]


def registrar_rotas_de_fotos(router: APIRouter, local_permitido: Callable[..., Place]) -> None:
    Local = Annotated[Place, Depends(local_permitido)]
    Db = Annotated[Session, Depends(get_db)]

    @router.post(
        "/places/{place_id}/photos",
        status_code=status.HTTP_201_CREATED,
        summary="Envia uma foto (corpo: a imagem); devolve as fotos do local",
        responses=_ERROS,
        openapi_extra={
            "requestBody": {
                "required": True,
                "content": {
                    tipo: {"schema": {"type": "string", "format": "binary"}}
                    for tipo in ("image/jpeg", "image/png", "image/webp")
                },
            }
        },
    )
    async def enviar_foto(request: Request, local: Local, db: Db) -> list[PhotoRead]:
        conteudo = await _ler_imagem(request)
        try:
            await run_in_threadpool(fotos.adicionar, db, local, conteudo)
        except fotos.LimiteDeFotos as exc:
            raise _erro(
                status.HTTP_409_CONFLICT,
                f"Cada local pode ter até {fotos.LIMITE_POR_LOCAL} fotos. Apague uma para enviar "
                "outra.",
            ) from exc
        except storage.FormatoNaoAceito as exc:
            raise _erro(
                status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "Use uma foto em JPG, PNG ou WebP."
            ) from exc
        return _lista(local)

    @router.delete(
        "/places/{place_id}/photos/{photo_id}",
        summary="Apaga a foto (e o arquivo); devolve as fotos do local",
        responses=_ERROS,
    )
    def apagar_foto(photo_id: uuid.UUID, local: Local, db: Db) -> list[PhotoRead]:
        try:
            fotos.remover(db, local, photo_id)
        except fotos.FotoNaoEncontrada as exc:
            raise _erro(status.HTTP_404_NOT_FOUND, "Foto não encontrada.") from exc
        return _lista(local)

    @router.post(
        "/places/{place_id}/photos/{photo_id}/capa",
        summary="Põe a foto em primeiro: é a que o turista vê",
        responses=_ERROS,
    )
    def tornar_capa(photo_id: uuid.UUID, local: Local, db: Db) -> list[PhotoRead]:
        try:
            fotos.tornar_capa(db, local, photo_id)
        except fotos.FotoNaoEncontrada as exc:
            raise _erro(status.HTTP_404_NOT_FOUND, "Foto não encontrada.") from exc
        return _lista(local)
