#!/usr/bin/env bash
# Contas da apresentação na produção (docs/demo.md). Roda o scripts/demo.py dentro da API:
#
#   ./scripts/demo.sh            # cria ou acerta catálogo inicial e contas; não apaga nada
#   ./scripts/demo.sh --reset    # apaga todas as contas, sessões e pedidos e recria as da demo
#                                # (pede para digitar RESETAR). Faça ./scripts/backup-db.sh antes.
set -euo pipefail

cd "$(dirname "$0")/.."
# Sem -T: o reset precisa do terminal para a confirmação.
exec docker compose -f compose.prod.yml --env-file .env.prod exec api python -m scripts.demo "$@"
