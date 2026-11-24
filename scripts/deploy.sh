#!/usr/bin/env bash
# Atualiza e sobe a produção na EC2: git pull, build, up, espera o health check e mostra o
# status. Rode de dentro do clone (~/algodoal-digital):
#
#   ./scripts/deploy.sh
#
# SEM_PULL=1 pula o git pull (para subir uma alteração local, ex.: só o .env.prod).
set -euo pipefail

cd "$(dirname "$0")/.."
COMPOSE=(docker compose -f compose.prod.yml --env-file .env.prod)

if [[ ! -f .env.prod ]]; then
  echo "Falta o .env.prod: cp .env.prod.example .env.prod e preencha (docs/deploy-aws.md)." >&2
  exit 1
fi
DOMAIN="$(grep -E '^DOMAIN=' .env.prod | tail -n1 | cut -d= -f2- | tr -d '"'"'"' \r')"
if [[ -z "$DOMAIN" ]]; then
  echo "DOMAIN está vazio no .env.prod." >&2
  exit 1
fi

if [[ "${SEM_PULL:-}" != "1" ]]; then
  echo "==> git pull"
  git pull --ff-only
fi
echo "==> versão: $(git log -1 --format='%h %s')"

echo "==> build e up (o primeiro build leva alguns minutos)"
# --wait: só volta quando todos os serviços estão healthy (ou falha depois do timeout).
if ! "${COMPOSE[@]}" up -d --build --remove-orphans --wait --wait-timeout 300; then
  echo
  echo "Algum serviço não ficou saudável. Últimas linhas dos logs:" >&2
  "${COMPOSE[@]}" ps
  "${COMPOSE[@]}" logs --tail 40
  exit 1
fi

echo
"${COMPOSE[@]}" ps

echo
echo "==> https://$DOMAIN/api/v1/health/db"
# O certificado pode levar alguns segundos no primeiro deploy (o Caddy pede ao Let's Encrypt).
# Com DOMAIN=localhost o certificado é do próprio Caddy: -k aceita.
inseguro=()
[[ "$DOMAIN" == "localhost" ]] && inseguro=(-k)
for tentativa in 1 2 3 4 5 6; do
  if curl -fsS "${inseguro[@]}" --max-time 10 "https://$DOMAIN/api/v1/health/db"; then
    echo
    echo "No ar: https://$DOMAIN"
    # Imagens antigas ocupam o disco de 20 GB a cada deploy.
    docker image prune -f >/dev/null
    exit 0
  fi
  echo "  ainda não respondeu (tentativa $tentativa/6); esperando 10 s..."
  sleep 10
done

echo "A API está saudável dentro do Docker, mas https://$DOMAIN não respondeu." >&2
echo "Veja o certificado: ${COMPOSE[*]} logs caddy | grep -iE 'error|acme|certificate'" >&2
exit 1
