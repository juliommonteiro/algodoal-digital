"""Onde ficam os arquivos das fotos (#29). Decisão 7 da arquitetura: pasta local em dev, atrás
desta interface, para dar para trocar por outro armazenamento sem mexer nas rotas.

A chave (storage_key) é gerada aqui e é o caminho relativo dentro da pasta: quem chama nunca
monta caminho a partir de entrada do usuário.
"""

import uuid
from pathlib import Path

from app.core.config import get_settings

# Assinatura dos primeiros bytes → extensão. O Content-Type que o cliente manda não é confiado.
ASSINATURAS = (
    (b"\xff\xd8\xff", "jpg"),
    (b"\x89PNG\r\n\x1a\n", "png"),
)


class FormatoNaoAceito(Exception):
    pass


def extensao_da_imagem(conteudo: bytes) -> str:
    """jpg, png ou webp pelos bytes do arquivo; qualquer outra coisa é recusada."""
    for assinatura, extensao in ASSINATURAS:
        if conteudo.startswith(assinatura):
            return extensao
    if conteudo[:4] == b"RIFF" and conteudo[8:12] == b"WEBP":
        return "webp"
    raise FormatoNaoAceito


def _pasta() -> Path:
    return Path(get_settings().media_dir)


def salvar_foto(place_id: uuid.UUID, conteudo: bytes) -> str:
    """Grava a imagem e devolve a chave, ex.: places/<id do local>/<uuid>.jpg."""
    chave = f"places/{place_id}/{uuid.uuid4().hex}.{extensao_da_imagem(conteudo)}"
    destino = _pasta() / chave
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_bytes(conteudo)
    return chave


def apagar(chave: str) -> None:
    """Melhor esforço: arquivo que já não existe não é erro."""
    destino = (_pasta() / chave).resolve()
    if _pasta().resolve() in destino.parents:
        destino.unlink(missing_ok=True)
