#!/usr/bin/env bash
# Gera frontend/public/mapa/algodoal.pmtiles: os tiles vetoriais só da região da ilha.
#
# Por que existe: a política de uso do OpenStreetMap proíbe baixar os tiles oficiais
# (tile.openstreetmap.org) para uso offline. Então o projeto gera o próprio arquivo, a partir
# de um build diário da Protomaps (dados do OSM, licença ODbL), recortado para a região.
#
# Uso (da raiz do repositório):
#     scripts/gerar-mapa.sh              # usa o build fixado em DATA_BUILD
#     scripts/gerar-mapa.sh 20261015     # usa outro build (AAAAMMDD)
#
# Requisitos: bash, curl, tar (ou unzip no macOS), sha256sum (ou shasum), jq (opcional,
# só para sugerir o build mais recente quando o fixado não existir mais).

set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# ---------------------------------------------------------------------------- parâmetros

# Build diário da Protomaps. Fixado para a geração ser reprodutível. A Protomaps guarda só
# os ~60 builds mais recentes (uns dois meses): quando este sair do ar, o passo 2 avisa e
# sugere o mais novo. Lista: https://maps.protomaps.com/builds
DATA_BUILD="${1:-20260930}"

# Recorte: da Ilha de Maiandeua até Marudá, o porto de onde saem os barcos. É em Marudá que o
# turista ainda tem sinal e abre o app pela primeira vez, então o mapa precisa cobrir a
# travessia. Ordem do pmtiles: oeste,sul,leste,norte.
BBOX="-47.68,-0.66,-47.51,-0.56"

# Os builds da Protomaps vão até o nível 15, e isso basta: os dados são vetoriais, então o
# MapLibre desenha a geometria do nível 15 nos zooms 16, 17, 18... sem perder nitidez — ao
# contrário de tiles de imagem, que ficariam borrados. Construções e caminhos da vila já estão
# no 15. Um --maxzoom acima de 15 não tem efeito: o arquivo de origem não tem esses níveis.
MAXZOOM=15

DESTINO="$RAIZ/frontend/public/mapa/algodoal.pmtiles"

# CLI da Protomaps, baixado das releases do GitHub para uma pasta ignorada pelo Git.
VERSAO_PMTILES="1.31.2"
FERRAMENTAS="$RAIZ/.ferramentas"
PMTILES="$FERRAMENTAS/pmtiles-$VERSAO_PMTILES"

# SHA-256 publicados pelo GitHub para cada pacote da release v1.31.2 (campo `digest` da API).
# O binário baixado só roda se bater com o hash daqui.
declare -A SHA256=(
  [Linux_x86_64]="3ed7dbf4ec2e6dfe5e25b6f70d1ffc932729f93c86db353bf514dd71010a312f"
  [Linux_arm64]="f8bd47e7ea866863489cad588fbaf2f31f42e5821f7a03f009b3769f05801cb1"
  [Darwin_x86_64]="1f0dc02eee6c58312dd6c509faee1b5c32f0596568af1bf51f1b034e7a88a65b"
  [Darwin_arm64]="40528f7f616fcbf91207cd48c8fc023d213f6d86c0cbf1f748732803d1880f3d"
)

passo() { printf '\n==> %s\n' "$*"; }
falha() { printf '\nERRO: %s\n' "$*" >&2; exit 1; }

calcular_sha256() {
  if command -v sha256sum >/dev/null; then sha256sum "$1" | cut -d' ' -f1
  else shasum -a 256 "$1" | cut -d' ' -f1; fi
}

tamanho_em_bytes() { wc -c <"$1" | tr -d ' '; }

# ---------------------------------------------------------------------------- 1. CLI pmtiles

passo "1/3 CLI pmtiles v$VERSAO_PMTILES"

if [[ -x "$PMTILES" ]]; then
  echo "Já existe em $PMTILES"
else
  # Plataforma no formato dos nomes de pacote da release: Linux_x86_64, Darwin_arm64, ...
  SO="$(uname -s)"
  ARQ="$(uname -m)"
  [[ "$ARQ" == "aarch64" ]] && ARQ="arm64"
  PLATAFORMA="${SO}_${ARQ}"
  HASH_ESPERADO="${SHA256[$PLATAFORMA]:-}"
  [[ -n "$HASH_ESPERADO" ]] || falha "plataforma $PLATAFORMA sem pacote conhecido do pmtiles"

  # Linux vem em .tar.gz; macOS em .zip (e com hífen no lugar do primeiro _ no nome).
  if [[ "$SO" == "Linux" ]]; then
    PACOTE="go-pmtiles_${VERSAO_PMTILES}_${PLATAFORMA}.tar.gz"
  else
    PACOTE="go-pmtiles-${VERSAO_PMTILES}_${PLATAFORMA}.zip"
  fi
  URL="https://github.com/protomaps/go-pmtiles/releases/download/v${VERSAO_PMTILES}/${PACOTE}"

  TEMP="$(mktemp -d)"
  trap 'rm -rf "$TEMP"' EXIT
  echo "Baixando $URL"
  curl -fL --retry 3 --progress-bar -o "$TEMP/$PACOTE" "$URL"

  HASH_OBTIDO="$(calcular_sha256 "$TEMP/$PACOTE")"
  [[ "$HASH_OBTIDO" == "$HASH_ESPERADO" ]] \
    || falha "SHA-256 do pacote não confere (esperado $HASH_ESPERADO, obtido $HASH_OBTIDO)"
  echo "SHA-256 confere."

  if [[ "$PACOTE" == *.tar.gz ]]; then
    tar -xzf "$TEMP/$PACOTE" -C "$TEMP" pmtiles
  else
    unzip -q "$TEMP/$PACOTE" pmtiles -d "$TEMP"
  fi
  mkdir -p "$FERRAMENTAS"
  install -m 0755 "$TEMP/pmtiles" "$PMTILES"
  echo "Instalado em $PMTILES"
fi

# ---------------------------------------------------------------------------- 2. extração

URL_BUILD="https://build.protomaps.com/${DATA_BUILD}.pmtiles"
passo "2/3 Extraindo o recorte de $URL_BUILD"

# O build some depois de ~2 meses. Sem ele, avisa e sugere o mais recente em vez de deixar
# o pmtiles falhar com uma mensagem genérica.
STATUS="$(curl -s -o /dev/null -w '%{http_code}' -I "$URL_BUILD")"
if [[ "$STATUS" != "200" ]]; then
  SUGESTAO=""
  if command -v jq >/dev/null; then
    SUGESTAO="$(curl -fs https://build-metadata.protomaps.dev/builds.json \
      | jq -r 'map(.key) | sort | last | sub("\\.pmtiles$"; "")' 2>/dev/null || true)"
  fi
  falha "o build $DATA_BUILD não está disponível (HTTP $STATUS).${SUGESTAO:+ O mais recente é $SUGESTAO: scripts/gerar-mapa.sh $SUGESTAO}"
fi

# O arquivo do planeta tem ~140 GB, mas o `extract` lê o índice e pede só os pedaços da região
# com requisições parciais (HTTP Range): o download é da ordem do tamanho do recorte.
# Grava num temporário e só então substitui o destino: uma extração interrompida não
# deixa um arquivo pela metade no lugar do bom.
mkdir -p "$(dirname "$DESTINO")"
PARCIAL="$DESTINO.parcial"
rm -f "$PARCIAL"
"$PMTILES" extract "$URL_BUILD" "$PARCIAL" --bbox="$BBOX" --maxzoom="$MAXZOOM"
mv -f "$PARCIAL" "$DESTINO"

# ---------------------------------------------------------------------------- 3. resumo

passo "3/3 Resultado"

BYTES="$(tamanho_em_bytes "$DESTINO")"
echo "Arquivo: ${DESTINO#"$RAIZ"/}"
echo "Tamanho: $BYTES bytes ($(awk -v b="$BYTES" 'BEGIN { printf "%.2f MB", b / 1048576 }'))"
echo
"$PMTILES" show "$DESTINO"
