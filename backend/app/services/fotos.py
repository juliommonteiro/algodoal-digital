"""Fotos de um local (#29): enviar, apagar e escolher a capa. Usado pelo painel admin e pelo
do parceiro; quem pode mexer em qual local é decidido nas rotas."""

import uuid

from sqlalchemy.orm import Session

from app.core import storage
from app.models import Place, PlacePhoto

LIMITE_POR_LOCAL = 6
# O app reduz a foto no celular antes de enviar (~300 kB); 5 MB cobre quem envia o original.
TAMANHO_MAXIMO = 5 * 1024 * 1024


class LimiteDeFotos(Exception):
    pass


class FotoNaoEncontrada(Exception):
    pass


def _renumerar(local: Place) -> None:
    for posicao, foto in enumerate(sorted(local.photos, key=lambda f: f.position)):
        foto.position = posicao


def adicionar(db: Session, local: Place, conteudo: bytes) -> PlacePhoto:
    """A foto nova entra no fim; a primeira de todas vira a capa."""
    if len(local.photos) >= LIMITE_POR_LOCAL:
        raise LimiteDeFotos
    chave = storage.salvar_foto(local.id, conteudo)  # FormatoNaoAceito sobe antes de gravar
    foto = PlacePhoto(place_id=local.id, storage_key=chave, position=len(local.photos))
    local.photos.append(foto)
    db.commit()
    db.refresh(local)
    return foto


def _foto(local: Place, foto_id: uuid.UUID) -> PlacePhoto:
    foto = next((f for f in local.photos if f.id == foto_id), None)
    if foto is None:
        raise FotoNaoEncontrada
    return foto


def remover(db: Session, local: Place, foto_id: uuid.UUID) -> None:
    foto = _foto(local, foto_id)
    chave = foto.storage_key
    local.photos.remove(foto)
    _renumerar(local)
    db.commit()
    storage.apagar(chave)  # depois do commit: se o banco falhar, o arquivo continua


def tornar_capa(db: Session, local: Place, foto_id: uuid.UUID) -> None:
    """A capa é a de position 0: é a que o turista vê primeiro."""
    foto = _foto(local, foto_id)
    foto.position = -1
    _renumerar(local)
    db.commit()
    db.refresh(local)
