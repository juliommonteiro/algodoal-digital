#!/usr/bin/env bash
# Cria labels, marcos (M1–M6) e as issues do backlog no repositório atual.
# Requer GitHub CLI autenticado: gh auth login
# Uso: ./scripts/setup-github.sh
set -euo pipefail

repo=$(gh repo view --json nameWithOwner -q .nameWithOwner)
echo "Configurando $repo"

label() { gh label create "$1" --color "$2" --force >/dev/null; }
label "tipo:feature" 1F4D3A
label "tipo:bug"     D73A4A
label "tipo:docs"    0075CA
label "tipo:infra"   5319E7
label "P0"           B60205
label "P1"           FBCA04
label "P2"           C5DEF5
for area in api web db offline mapa carroceiros gamificacao admin validacao; do
  label "area:$area" EDEDED
done

milestone() {
  gh api "repos/$repo/milestones" -f title="$1" -f due_on="$2T23:59:59Z" -f description="$3" >/dev/null 2>&1 \
    || echo "  marco '$1' já existe"
}
milestone "M1 · S2"  2026-09-13 "Cronograma e escopo congelado"
milestone "M2 · S4"  2026-09-27 "Relatório de validação e base de dados inicial"
milestone "M3 · S6"  2026-10-11 "PWA instalável com mapa base e pontos reais"
milestone "M4 · S9"  2026-11-01 "Demo interna do mapa e diretório com dados reais"
milestone "M5 · S12" 2026-11-22 "Fluxos críticos testados e AWS preparada"
milestone "M6 · S13" 2026-11-29 "Deploy, documentação e apresentação"

# marco|labels|título
while IFS='|' read -r ms labels title; do
  [[ -z "$ms" || "$ms" == \#* ]] && continue
  gh issue create --title "$title" --milestone "$ms" --label "$labels" \
    --body "Item do [backlog](../blob/main/docs/backlog.md). Ver cronograma da semana correspondente." >/dev/null
  echo "  + $title"
done <<'ISSUES'
M1 · S2|tipo:docs,P0|Diagrama ER e documento de arquitetura
M1 · S2|tipo:docs,P0,area:validacao|Roteiro de entrevistas e checklist de campo
M2 · S4|tipo:infra,P0,area:api|Docker Compose com API + PostgreSQL
M2 · S4|tipo:infra,P0|CI com lint e testes a cada push
M2 · S4|tipo:feature,P0,area:web|Esqueleto FastAPI e PWA Vite instalável
M2 · S4|tipo:docs,P0,area:validacao|Relatório de campo + planilha de praias, pontos e prestadores
M2 · S4|tipo:feature,P0,area:db|Migrações: users, categories, places, businesses, carriers
M3 · S6|tipo:feature,P0,area:db|Script de importação da planilha de campo (seed)
M3 · S6|tipo:feature,P0,area:api|Cadastro, login, refresh token e perfis
M3 · S6|tipo:feature,P0,area:api|Endpoints de locais e categorias
M3 · S6|tipo:feature,P0,area:web|Layout mobile-first com as rotas principais
M3 · S6|tipo:feature,P0,area:admin|Painel mínimo: CRUD de locais e estabelecimentos
M3 · S6|tipo:feature,P0,area:mapa|MapLibre com PMTiles da ilha e pontos reais
M3 · S6|tipo:feature,P0,area:web|Service Worker e app instalável no celular
M4 · S9|tipo:feature,P0,area:mapa|Camadas por categoria e filtros
M4 · S9|tipo:feature,P1,area:mapa|Localização do usuário no mapa
M4 · S9|tipo:feature,P0,area:api|Modelo e API de perfil de estabelecimento
M4 · S9|tipo:feature,P0,area:mapa|Tela de detalhe do ponto
M4 · S9|tipo:feature,P0,area:offline|IndexedDB + pull do catálogo
M4 · S9|tipo:feature,P0,area:web|Perfil do estabelecimento com fotos e horários
M4 · S9|tipo:feature,P0,area:web|Diretório com busca e botão de WhatsApp
M4 · S9|tipo:feature,P0,area:carroceiros|Cadastro dos carroceiros participantes
M5 · S12|tipo:feature,P0,area:carroceiros|Solicitação de transporte
M5 · S12|tipo:feature,P0,area:carroceiros|Tela do carroceiro: aceitar/recusar
M5 · S12|tipo:feature,P0,area:gamificacao|Modelo de missões, pontos e recompensas
M5 · S12|tipo:feature,P0,area:gamificacao|Registro de ação ambiental com QR e evidência
M5 · S12|tipo:feature,P0,area:web|Leitura de QR Code no PWA
M5 · S12|tipo:feature,P0,area:web|Passaporte com check-ins, progresso e conquistas
M5 · S12|tipo:feature,P1,area:gamificacao|Resgate de recompensa com código
M5 · S12|tipo:feature,P0,area:offline|Fila Outbox + sync de eventos idempotente
M5 · S12|tipo:feature,P1,area:admin|Validação de ações ambientais e indicadores
M5 · S12|tipo:feature,P0|Testes integrados dos fluxos críticos
M5 · S12|tipo:infra,P0|Conta AWS, IAM, S3, RDS e hospedagem
M6 · S13|tipo:infra,P0|Deploy API + PWA com CI/CD e CloudWatch
M6 · S13|tipo:infra,P0|Domínio e HTTPS
M6 · S13|tipo:feature,P0|Teste da versão publicada em rede móvel
M6 · S13|tipo:docs,P0|Documentação de operação e ensaio da apresentação
ISSUES

echo "Pronto. Crie o board em Projects > New project > Board e adicione as issues."
