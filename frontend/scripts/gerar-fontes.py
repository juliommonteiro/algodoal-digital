#!/usr/bin/env python3
"""Gera as duas fontes do app em public/fonts/, reduzidas aos glifos que a interface escreve.

Por que existe: o app precisa abrir offline, então as fontes vão para o precache do service
worker e o celular baixa tudo na instalação. Três cortes deixam isso pequeno:

1. IBM Plex Sans *variável* (pesos 100-700 num arquivo só) no lugar de quatro estáticos.
2. Só o subset `latin`: o português inteiro cabe nele; o `latin-ext` é europeu central/oriental.
3. Subset por caractere: cada fonte fica só com os glifos da lista CARACTERES abaixo.

Como rodar (dentro de frontend/):

    npm install                      # traz @fontsource-variable/ibm-plex-sans e @fontsource/ibm-plex-mono
    pip install fonttools brotli     # use --break-system-packages se o pip recusar
    python scripts/gerar-fontes.py

Rode de novo sempre que a interface passar a escrever um caractere fora da lista — senão ele
cai para a fonte do sistema.
"""

from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

FRONTEND = Path(__file__).resolve().parent.parent
DESTINO = FRONTEND / "public" / "fonts"

FONTES = [
    (
        FRONTEND
        / "node_modules/@fontsource-variable/ibm-plex-sans/files/ibm-plex-sans-latin-wght-normal.woff2",
        DESTINO / "plex-sans-var.woff2",
    ),
    (
        FRONTEND / "node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff2",
        DESTINO / "plex-mono-500.woff2",
    ),
]

# Caracteres que a interface escreve.
# Atenção: "→" (U+2192) e "✓" (U+2713) NÃO existem na IBM Plex, por isso não estão aqui.
# Na tela eles são ícones SVG (src/components/Icone.tsx: "seta" e "conferido").
VOGAIS_ACENTUADAS = "áàâãä éèêë íìîï óòôõö úùûü ç ñ".replace(" ", "")
CARACTERES = "".join(
    [
        "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
        "abcdefghijklmnopqrstuvwxyz",
        "0123456789",
        VOGAIS_ACENTUADAS,
        VOGAIS_ACENTUADAS.upper(),
        ".,;:!?'\"()[]{}/\\|@#$%&*+-=_<>~^ºª°",
        " ",
        # · • × — – … « » “ ” ‘ ’ € ↑ ↓   ("R$" já está coberto por R e $)
        "·•×—–…«»“”‘’€↑↓",
    ]
)


def unicodes(texto: str) -> str:
    return ",".join(f"U+{ord(c):04X}" for c in sorted(set(texto)))


def comando_pyftsubset() -> list[str]:
    binario = shutil.which("pyftsubset")
    # Sem o binário no PATH, o módulo do mesmo Python é o mesmo pyftsubset.
    return [binario] if binario else [sys.executable, "-m", "fontTools.subset"]


def main() -> int:
    DESTINO.mkdir(parents=True, exist_ok=True)
    total_antes = total_depois = 0

    for origem, saida in FONTES:
        if not origem.exists():
            print(f"Origem não encontrada: {origem}\nRode `npm install` em frontend/.", file=sys.stderr)
            return 1
        # NÃO passe --layout-features. O conjunto padrão do pyftsubset mantém kern, mark, mkmk,
        # locl e rvrn. Restringir a lista quebra o kerning ("trilhas" vira "t rilhas",
        # "Alimentação" vira "Aliment ação") e, na fonte variável, a troca de glifos por eixo.
        # Testado e confirmado.
        subprocess.run(
            [
                *comando_pyftsubset(),
                str(origem),
                f"--unicodes={unicodes(CARACTERES)}",
                "--flavor=woff2",
                "--desubroutinize",
                f"--output-file={saida}",
            ],
            check=True,
        )
        antes, depois = origem.stat().st_size, saida.stat().st_size
        total_antes += antes
        total_depois += depois
        print(f"{saida.name:<22} {antes:>8,} B -> {depois:>8,} B  ({depois / antes:.0%})")

    print(f"{'total':<22} {total_antes:>8,} B -> {total_depois:>8,} B  ({total_depois / total_antes:.0%})")
    print(f"{len(set(CARACTERES))} caracteres na lista.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
