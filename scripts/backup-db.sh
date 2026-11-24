#!/usr/bin/env bash
# Cópia do banco de produção, compactada, em backups/ (fora do git):
#
#   ./scripts/backup-db.sh
#
# Baixe para o Windows com o scp que o script mostra no fim. Restaurar (apaga o que existe e
# põe a cópia no lugar):
#
#   gunzip -c backups/ARQUIVO.sql.gz | docker compose -f compose.prod.yml --env-file .env.prod \
#     exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
#
# Só o banco. As fotos ficam no volume "fotos" (veja docs/deploy-aws.md, "Backup das fotos").
set -euo pipefail

cd "$(dirname "$0")/.."
mkdir -p backups
arquivo="backups/algodoal-$(date +%Y%m%d-%H%M%S).sql.gz"
# Arquivo pela metade não fica para trás, parecendo um backup bom.
trap 'rm -f "$arquivo"' ERR

# Usuário e banco vêm das variáveis do próprio container do Postgres.
# --clean --if-exists: a restauração apaga as tabelas antes de recriar.
docker compose -f compose.prod.yml --env-file .env.prod exec -T db \
  sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner' |
  gzip -9 >"$arquivo"

# Um dump sem a última linha de conclusão foi cortado no meio.
if ! gunzip -c "$arquivo" | tail -n 5 | grep -q "PostgreSQL database dump complete"; then
  echo "O dump não terminou: $arquivo está incompleto." >&2
  rm -f "$arquivo"
  exit 1
fi

echo "Backup: $PWD/$arquivo ($(du -h "$arquivo" | cut -f1))"
ip="$(curl -fsS --max-time 3 https://checkip.amazonaws.com 2>/dev/null || echo SEU-ELASTIC-IP)"
echo "No PowerShell do Windows:"
echo "  scp -i \$HOME\\.ssh\\algodoal-demo.pem ubuntu@${ip}:$PWD/$arquivo ."
