# Backlog priorizado

> Entrega da S2. Prioridade: **P0** = sem isso não há MVP em dezembro · **P1** = previsto no cronograma, corta se atrasar · **P2** = fica para depois do MVP.
> Responsável sugerido segue a divisão do PRD (seção 34): **James** backend/infra, **Julio** frontend/PWA/offline, **Leonardo** produto/dados/validação/testes.

| # | Épico | Item | Sem. | Prio | Resp. |
|---|---|---|---|---|---|
| 1 | Fundação | Repositório, README, padrões de commit e board | S2 | P0 | Julio |
| 2 | Fundação | Diagrama ER e documento de arquitetura | S2 | P0 | James |
| 3 | Validação | Roteiro de entrevistas e checklist de campo | S1–S2 | P0 | Leonardo |
| 4 | Fundação | Docker Compose com API + PostgreSQL | S3 | P0 | James |
| 5 | Fundação | CI com lint e testes a cada push | S3 | P0 | Julio |
| 6 | Fundação | Esqueleto FastAPI e PWA Vite instalável | S3 | P0 | Julio |
| 7 | Validação | Relatório de campo + planilha de praias, pontos e prestadores | S4 | P0 | Leonardo |
| 8 | Dados | Migrações: users, categories, places, businesses, carriers | S4 | P0 | James |
| 9 | Dados | Script de importação da planilha de campo para o banco (seed) | S4–S5 | P0 | Leonardo |
| 10 | Autenticação | Cadastro, login, refresh token e perfis | S5 | P0 | James |
| 11 | Mapa | Endpoints de locais e categorias (lista, detalhe) | S5 | P0 | James |
| 12 | Frontend | Layout mobile-first com as rotas principais | S5 | P0 | Julio |
| 13 | Admin | Painel mínimo: CRUD de locais e estabelecimentos | S6 | P0 | James |
| 14 | Mapa | MapLibre com PMTiles da ilha e pontos reais | S6 | P0 | Julio |
| 15 | Frontend | Service Worker e app instalável no celular | S6 | P0 | Julio |
| 16 | Mapa | Camadas por categoria e filtros | S7 | P0 | Julio |
| 17 | Mapa | Localização do usuário (só com permissão) | S7 | P1 | Julio |
| 18 | Marketplace | Modelo e API de perfil de estabelecimento | S7 | P0 | James |
| 19 | Mapa | Tela de detalhe do ponto | S8 | P0 | Julio |
| 20 | Offline | IndexedDB (Dexie) + pull do catálogo `/sync/catalog` | S8 | P0 | Julio |
| 21 | Marketplace | Perfil com fotos, descrição, horários e serviços | S8 | P0 | Julio |
| 22 | Marketplace | Diretório com busca e botão de WhatsApp | S9 | P0 | Julio |
| 23 | Carroceiros | Cadastro dos carroceiros participantes | S9 | P0 | Leonardo |
| 24 | Carroceiros | Solicitação de transporte (origem, destino, passageiros) | S10 | P0 | James |
| 25 | Carroceiros | Tela do carroceiro: aceitar/recusar + contato | S10 | P0 | Julio |
| 26 | Gamificação | Modelo de missões, pontos e recompensas | S10 | P0 | Leonardo |
| 27 | Preservação | Registro de ação ambiental com QR e evidência | S11 | P0 | James |
| 28 | Passaporte | Leitura de QR Code no PWA | S11 | P0 | Julio |
| 29 | Passaporte | Passaporte com check-ins, progresso e conquistas | S11 | P0 | Julio |
| 30 | Gamificação | Resgate de recompensa com código para o parceiro | S11 | P1 | James |
| 31 | Offline | Fila Outbox + `POST /sync/events` idempotente | S12 | P0 | Julio + James |
| 32 | Admin | Validar ações ambientais e ver indicadores | S12 | P1 | James |
| 33 | Qualidade | Testes integrados dos fluxos críticos | S12 | P0 | Leonardo |
| 34 | Infra | Conta AWS, IAM, S3, RDS e hospedagem definidos | S12 | P0 | James |
| 35 | Infra | Deploy API + PWA com CI/CD e CloudWatch | S13 | P0 | James |
| 36 | Infra | Domínio e HTTPS | S13 | P0 | James |
| 37 | Qualidade | Teste da versão publicada em rede móvel | S13 | P0 | Leonardo |
| 38 | Docs | Documentação de operação e ensaio da apresentação | S13 | P0 | Leonardo |
| 39 | Autenticação | Recuperação de senha por e-mail | — | P2 | — |
| 40 | Gamificação | Ranking de usuários | — | P2 | — |
| 41 | Carroceiros | Histórico de corridas | — | P2 | — |

## Itens do PRD que não estavam no cronograma

Estes aparecem nos critérios de aceitação ou no backlog do PRD mas não tinham semana. Foram encaixados acima ou marcados como P2 — **a equipe precisa concordar**:

- **Domínio e HTTPS** (critério de aceitação) → encaixado na S13 (#36).
- **Resgate de recompensas** (critério "recompensas funcionarem") → S11 como P1 (#30).
- **Script de seed a partir da planilha de campo** → S4–S5 (#9); sem ele o M3 "pontos reais" depende de digitação manual.
- **Recuperação de senha, ranking e histórico de corridas** → P2. Nenhum é critério de aceitação.
