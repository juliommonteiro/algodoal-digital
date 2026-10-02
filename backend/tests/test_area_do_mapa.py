"""A área do mapa (bbox) está escrita em três arquivos, em três linguagens, e eles têm de bater.

Por que este teste existe: se divergirem, o admin consegue salvar um local fora da área coberta
pelos tiles (a API valida com um número, o mapa foi recortado com outro) e o local some do mapa
sem erro nenhum. Lê os arquivos como texto, com regex — não importa o TypeScript nem roda o
shell.

Provisório: a unificação numa fonte única fica para depois da AV1 (issue #50). Quando ela
existir, este teste sai.

Onde roda: o CI (.github/workflows/ci.yml, job "API") roda o pytest direto no runner, com o
checkout inteiro do repositório — a raiz é o pai de backend/ e os três arquivos estão lá. O
container da API NÃO é necessário para este teste. As montagens só leitura de frontend/src/lib e
scripts/ no docker-compose.yml existem só para ele também rodar localmente com
`docker compose exec api pytest` (o container monta backend/ em /app, e as montagens põem os
outros dois arquivos nos mesmos caminhos relativos, a partir de /).

Arquivo que não for encontrado faz o teste FALHAR, com mensagem — nunca pular nem passar: um
guarda que some calado é pior que nenhum.

Tirar este teste do pytest fica para a issue #50, junto com a fonte única.
"""

import re
from pathlib import Path

import pytest

from app.schemas import admin

BACKEND = Path(__file__).resolve().parents[1]
RAIZ = BACKEND.parent

ARQUIVOS = {
    "frontend": RAIZ / "frontend" / "src" / "lib" / "areaDoMapa.ts",
    "backend": BACKEND / "app" / "schemas" / "admin.py",
    "tiles": RAIZ / "scripts" / "gerar-mapa.sh",
}

LADOS = ("oeste", "sul", "leste", "norte")
NUMERO = r"(-?\d+(?:\.\d+)?)"


def _ler(nome: str) -> str:
    caminho = ARQUIVOS[nome]
    if not caminho.is_file():
        pytest.fail(
            f"{caminho} não encontrado: sem ele não dá para conferir a área do mapa. Se o arquivo "
            "mudou de lugar ou de nome, atualize ARQUIVOS neste teste. Rodando no container da "
            "API, recrie-o para pegar as montagens do docker-compose.yml: docker compose up -d api"
        )
    return caminho.read_text(encoding="utf-8")


def _bbox_do_frontend(texto: str) -> dict[str, float]:
    # export const OESTE = -47.68
    valores = {}
    for lado in LADOS:
        achados = re.findall(rf"export const {lado.upper()} = {NUMERO}", texto)
        assert len(achados) == 1, f"areaDoMapa.ts: esperava um {lado.upper()}, achei {achados}"
        valores[lado] = float(achados[0])
    return valores


def _bbox_do_backend(texto: str) -> dict[str, float]:
    # OESTE, SUL, LESTE, NORTE = -47.68, -0.66, -47.51, -0.56
    achados = re.findall(
        rf"^OESTE, SUL, LESTE, NORTE = {NUMERO}, {NUMERO}, {NUMERO}, {NUMERO}$",
        texto,
        re.MULTILINE,
    )
    assert len(achados) == 1, f"schemas/admin.py: esperava uma linha da bbox, achei {achados}"
    return dict(zip(LADOS, map(float, achados[0]), strict=True))


def _bbox_dos_tiles(texto: str) -> dict[str, float]:
    # BBOX="-47.68,-0.66,-47.51,-0.56"  (ordem do pmtiles: oeste,sul,leste,norte)
    achados = re.findall(rf'^BBOX="{NUMERO},{NUMERO},{NUMERO},{NUMERO}"$', texto, re.MULTILINE)
    assert len(achados) == 1, f"gerar-mapa.sh: esperava um BBOX, achei {achados}"
    return dict(zip(LADOS, map(float, achados[0]), strict=True))


def test_a_bbox_e_a_mesma_no_frontend_no_backend_e_no_recorte_dos_tiles():
    bboxes = {
        "frontend": _bbox_do_frontend(_ler("frontend")),
        "backend": _bbox_do_backend(_ler("backend")),
        "tiles": _bbox_dos_tiles(_ler("tiles")),
    }

    assert bboxes["frontend"] == bboxes["backend"] == bboxes["tiles"], (
        "A área do mapa divergiu entre os arquivos (issue #50): "
        + "; ".join(f"{nome} {valores}" for nome, valores in bboxes.items())
    )


def test_a_bbox_lida_do_backend_e_a_que_a_api_usa():
    # O parse por texto do schema tem de achar os mesmos números que o código importa.
    assert _bbox_do_backend(_ler("backend")) == {
        "oeste": admin.OESTE,
        "sul": admin.SUL,
        "leste": admin.LESTE,
        "norte": admin.NORTE,
    }


def test_a_bbox_e_um_retangulo_de_verdade():
    bbox = _bbox_dos_tiles(_ler("tiles"))
    assert bbox["oeste"] < bbox["leste"]
    assert bbox["sul"] < bbox["norte"]
