# Algodoal Digital

Plataforma PWA offline-first para turismo, economia local e preservação ambiental em Algodoal, Ilha de Maiandeua (PA).

Mapa da ilha · diretório de negócios locais · conexão com carroceiros · missões ambientais · passaporte digital — funcionando mesmo com internet instável.

**Equipe:** James Cook Junior · Julio Monteiro · Leonardo Moreira
**MVP:** dezembro de 2026

## Stack

| Parte | Tecnologia |
|---|---|
| Frontend | React + TypeScript + Vite, `vite-plugin-pwa` (Workbox), MapLibre GL |
| Backend | Python 3.12 + FastAPI, SQLAlchemy 2, Alembic |
| Banco | PostgreSQL 16 |
| Offline | Service Worker, IndexedDB, fila Outbox |
| Infra | Docker Compose (dev), GitHub Actions (CI), AWS (produção) |

## Rodando localmente

Pré-requisitos: Docker, Node 22+.

```bash
cp .env.example .env
docker compose up -d --build      # API em http://localhost:8000/docs
cd frontend && npm install && npm run dev   # PWA em http://localhost:5173
```

Conferir se está tudo de pé:

```bash
curl localhost:8000/api/v1/health      # {"status":"ok",...}
curl localhost:8000/api/v1/health/db   # {"status":"ok","database":"up"}
```

Atalhos no `Makefile`: `make up`, `make logs`, `make test`, `make lint`, `make revision m="mensagem"`.

## Testes e lint

```bash
# backend (dentro do container)
make lint && make test

# frontend
cd frontend
npm run lint && npm test && npm run build
```

O CI roda tudo isso a cada push e em todo PR, incluindo `alembic upgrade head` num PostgreSQL limpo.

> Para testar o PWA instalável e o Service Worker, use `npm run build && npm run preview` — em `npm run dev` o SW fica desligado.

## Estrutura

```
.
├── backend/          # FastAPI
│   ├── app/
│   │   ├── api/      # rotas
│   │   ├── core/     # configuração
│   │   ├── db/       # sessão e base dos models
│   │   └── models/
│   ├── alembic/      # migrações
│   └── tests/
├── frontend/         # PWA React
│   └── src/
│       ├── components/
│       ├── pages/
│       └── lib/
├── docs/             # arquitetura, modelo de dados, backlog
├── scripts/          # setup do GitHub
└── docker-compose.yml
```

## Documentação

- [Arquitetura](docs/arquitetura.md)
- [Modelo de dados](docs/modelo-dados.md)
- [Backlog priorizado](docs/backlog.md)
- [Como contribuir](CONTRIBUTING.md) — branches, commits e PRs

## Mapa

Dados do mapa © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), licença ODbL.
