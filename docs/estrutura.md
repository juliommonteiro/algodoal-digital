# Estrutura do projeto

Mapa de referência: onde fica cada coisa e onde moram as constantes que mais de um lugar usa. Árvores até 2 níveis abaixo de `frontend/src` e `backend/app`; pastas mais fundas aparecem como uma linha só. Atualize quando criar, mover ou apagar arquivo.

## frontend/src

```
frontend/src/
├── main.tsx                    entrada: monta o App e aquece o cache do catálogo no service worker
├── App.tsx                     cria o roteador a partir de routes.tsx
├── App.test.tsx                testes das rotas públicas, protegidas e do formulário de acesso
├── routes.tsx                  todas as rotas: públicas, por sessão, por perfil e /admin (lazy)
├── env.d.ts                    tipos das variáveis VITE_API_URL e VITE_USAR_MOCK
├── index.css                   importa os estilos na ordem: fontes, tokens, base, ui, telas
├── admin/                      painel administrativo (chunk próprio, fora do precache)
│   ├── PainelAdmin.tsx         casca do painel: barra lateral e escolha da tela pelo caminho
│   ├── PainelAdmin.test.tsx    testes de acesso, lista e formulário do painel
│   ├── ListaDeLocais.tsx       tabela de locais com busca, filtros, remover e restaurar
│   ├── FormularioDoLocal.tsx   criar e editar local, com dados comerciais e erros por campo
│   ├── cliente.ts              cliente de /api/v1/admin (HTTP e mock) e limpeza do cache público
│   ├── campos.tsx              select, textarea e caixa de seleção no padrão do <Campo>
│   ├── aviso.tsx               mensagem de sucesso ou erro anunciada ao leitor de tela
│   ├── opcoes.ts               rótulos de status e opções de categoria em árvore
│   └── admin.css               estilos do painel (desktop primeiro)
├── auth/                       sessão e controle de acesso
│   ├── AuthContext.tsx         provedor da sessão offline-first, com renovação em segundo plano
│   ├── AuthContext.test.tsx    testes de login, renovação e sessão offline
│   ├── contexto.ts             contexto React e hook useAuth
│   ├── sessao.ts               leitura e gravação da sessão no localStorage
│   ├── destino.ts              para onde voltar depois do login (só caminho interno)
│   └── RotaProtegida.tsx       exige sessão ou perfil; manda para o login ou para outra rota
├── components/                 componentes compartilhados entre telas
│   ├── Layout.tsx              casca com cabeçalho e abas (Mapa, Diretório, Carroça, Passaporte)
│   ├── Raiz.tsx                rota-raiz: põe o AuthProvider em volta de tudo
│   ├── CascaAcesso.tsx         fundo verde das telas /entrar e /criar-conta
│   ├── FiltrosCatalogo.tsx     busca e chips de categoria do mapa e do diretório
│   ├── ListaLocais.tsx         lista de locais com contagem
│   ├── ItemLocal.tsx           cartão de um local na lista
│   ├── FotoLocal.tsx           foto principal do local, com substituto quando não há
│   ├── FalhaCarga.tsx          aviso de erro de carga com "Tentar de novo"
│   ├── OfflineBanner.tsx       faixa "Sem internet" quando o navegador está offline
│   ├── Icone.tsx               ícones de interface desenhados à mão (grid 24x24)
│   ├── Icone.test.tsx          testes dos ícones em linha
│   ├── mapa/                   mapa MapLibre + PMTiles offline: estilo, cores, marcadores, ícones por tipo, legenda, avisos
│   └── ui/                     componentes base: Botao, Campo, Card, Chip, Rotulo, Carregando, EstadoVazio, ui.css
├── lib/                        dados, contrato da API e utilitários
│   ├── tipos.ts                contrato com a API: Local, Categoria, Usuario, TipoLocal, Perfil…
│   ├── api.ts                  cliente HTTP, ErroApi (com erros por campo) e token de acesso
│   ├── api.test.ts             testes da conversão dos erros da API
│   ├── cliente.ts              escolhe entre API real e mock (VITE_USAR_MOCK)
│   ├── mock.ts                 API de mentira com os mesmos dados fictícios do seed
│   ├── mock.test.ts            testes do mock
│   ├── catalogo.ts             carrega categorias e locais, filtra e guarda filtros na URL
│   ├── catalogo.test.ts        testes do filtro do catálogo
│   ├── cacheDoCatalogo.ts      busca o catálogo de novo quando o service worker assume
│   ├── cacheDoCatalogo.test.ts testes do aquecimento do cache
│   ├── categorias.ts           árvore de categorias: raízes, descendentes, raiz de uma categoria
│   ├── areaDoMapa.ts           bbox do mapa e mensagens de coordenada fora da área
│   ├── formatos.ts             rótulos de tipo, dias, horários, preço, links de WhatsApp e telefone
│   ├── validacao.ts            validação de e-mail, senha e nome no cliente
│   ├── useCarregar.ts          hook de carga com estados carregando, ok e erro
│   └── useOnlineStatus.ts      hook que diz se o navegador está online
├── pages/                      uma tela por rota
│   ├── MapaPage.tsx            mapa com filtros, card do local e lista
│   ├── DiretorioPage.tsx       todos os locais publicados em lista
│   ├── LocalPage.tsx           detalhe do local (funciona offline para o que já foi aberto)
│   ├── AcessoPage.tsx          login
│   ├── CadastroPage.tsx        criar conta
│   ├── AdminPage.tsx           carrega o painel sob demanda e avisa quando não abre sem rede
│   ├── CarrocaPage.tsx         pedido de carroça (placeholder até a S10)
│   ├── PassaportePage.tsx      passaporte (placeholder até a S11)
│   ├── EmBrevePage.tsx         placeholder das áreas de carroceiro e parceiro
│   └── NotFoundPage.tsx        página não encontrada
├── styles/                     estilos globais
│   ├── tokens.css              cores, espaçamentos, raios e alvo de toque
│   ├── fontes.css              IBM Plex auto-hospedada (@font-face)
│   ├── base.css                reset leve, tipografia, foco e movimento reduzido
│   └── telas.css               layout das telas, mobile-first
└── test/                       infraestrutura dos testes
    ├── setup.ts                prepara cada teste: mock sem atraso, fetch controlado, MapLibre falso
    ├── utils.tsx               renderizar numa rota, simular sessão, usuários de teste
    └── maplibre-falso.ts       MapLibre de mentira para o jsdom (sem WebGL)
```

## backend/app

```
backend/app/
├── main.py                     cria a aplicação FastAPI: CORS, rate limiting, rotas
├── api/                        camada HTTP
│   ├── router.py               junta as rotas sob /api/v1
│   ├── deps.py                 dependências de autenticação e de perfil (401 e 403)
│   └── routes/                 uma rota por recurso: health, auth, categories, places, admin
├── core/                       configuração e segurança
│   ├── config.py               Settings: variáveis de ambiente e valores padrão
│   ├── security.py             hash de senha (Argon2) e tokens JWT
│   └── limites.py              rate limiting por IP (slowapi)
├── db/                         banco de dados
│   ├── base.py                 Base do SQLAlchemy, nomes de constraint, mixins de UUID e datas
│   └── session.py              engine, SessionLocal e a dependência get_db
├── models/                     tabelas (SQLAlchemy)
│   ├── __init__.py             importa todos os models para o Alembic
│   ├── user.py                 usuário e os quatro perfis
│   ├── category.py             categorias em árvore
│   ├── place.py                local do mapa, com tipo, coordenada, publicação e remoção lógica
│   ├── business.py             dados comerciais de um local (1:1)
│   ├── place_photo.py          fotos de um local (só a chave no storage)
│   ├── carrier.py              perfil de carroceiro (1:1 com usuário)
│   └── refresh_token.py        tokens de renovação emitidos, para revogar e detectar reuso
├── schemas/                    entrada e saída da API (Pydantic), espelho de frontend/src/lib/tipos.ts
│   ├── auth.py                 cadastro, login, tokens e perfil
│   ├── category.py             categoria
│   ├── place.py                local, negócio, foto e o enum PlaceKind
│   └── admin.py                escrita do painel, com validação da área do mapa
└── services/                   regras de negócio (o que os testes cobrem)
    ├── auth.py                 cadastro, login, renovação com rotação, logout e reuso
    ├── catalog.py              catálogo público (só leitura)
    └── admin_catalog.py        catálogo do painel: listar tudo, criar, editar, remover, restaurar
```

## Constantes compartilhadas

Algumas constantes existem em mais de um lugar, às vezes em linguagens diferentes. Mudou numa, mude nas outras.

### bbox do mapa (-47,68 / -0,66 a -47,51 / -0,56)

| Onde | O que |
|---|---|
| `frontend/src/lib/areaDoMapa.ts` | `OESTE`, `SUL`, `LESTE`, `NORTE` e as mensagens de fora da área. **Fonte no frontend**: importe daqui |
| `frontend/src/components/mapa/estilo.ts` | `LIMITES` (maxBounds do mapa), montado a partir de `areaDoMapa.ts` |
| `backend/app/schemas/admin.py` | os mesmos quatro números, para recusar local fora da área |
| `scripts/gerar-mapa.sh` | `BBOX`, o recorte dos tiles em `frontend/public/mapa/algodoal.pmtiles` |

Nenhum teste compara as três cópias (TypeScript, Python e shell).

Centro e zooms do mapa (`CENTRO_DA_VILA`, `ZOOM_INICIAL`, `ZOOM_MINIMO`, `ZOOM_MAXIMO`) ficam em `frontend/src/components/mapa/estilo.ts`.

### Cores

| Onde | O que |
|---|---|
| `frontend/src/styles/tokens.css` | **fonte**: todos os tokens de cor (hex e OKLCH) |
| `frontend/src/components/mapa/cores.ts` | cópia em hex para o MapLibre, que não lê variável CSS; `cores.test.ts` confere com o tokens.css |
| `frontend/src/components/mapa/icones.tsx` | `GRUPOS` e `TIPOS`: grupo de cada tipo de local e cor do pino |
| `frontend/vite.config.ts` | `background_color` e `theme_color` do manifest |
| `frontend/index.html` | `<meta name="theme-color">` |
| `frontend/public/favicon.svg` | cores do favicon, à mão |

### Tipos (contrato frontend ↔ backend)

| Frontend | Backend |
|---|---|
| `frontend/src/lib/tipos.ts`: `Local`, `Categoria`, `Usuario`, `Negocio`, `Foto`, `LocalAdmin` | `backend/app/schemas/*.py` (o mesmo contrato em snake_case) |
| `TipoLocal` (7 valores) | `PlaceKind` em `schemas/place.py` e o CheckConstraint de `models/place.py` |
| `Perfil` | `Perfil` em `schemas/auth.py` e `USER_ROLES` em `models/user.py` |
| `StatusAdmin` | `StatusAdmin` em `schemas/admin.py` |

Rótulos em português dos tipos de local: `ROTULO_TIPO` em `frontend/src/lib/formatos.ts`, usado na lista, no painel, na legenda e no aria-label dos marcadores.

### Configuração

| Onde | O que |
|---|---|
| `.env.example` (raiz) | variáveis do backend e do Docker Compose |
| `backend/app/core/config.py` | `Settings`: `DATABASE_URL` (obrigatória), `SECRET_KEY`, `ENVIRONMENT`, CORS e duração dos tokens |
| `frontend/.env.example` e `frontend/src/env.d.ts` | `VITE_API_URL` e `VITE_USAR_MOCK` |
| `frontend/src/lib/cliente.ts` | `usandoMock`: liga a API real ou o mock |
| `frontend/vite.config.ts` | manifest do PWA, precache e runtime caching do Workbox, proxy de `/api` |
| `docker-compose.yml` e `Makefile` | serviços `api` e `db`, e atalhos (`make test`, `make seed`, `make lint`…) |

## Escopos de commit

Formato do CONTRIBUTING: `<tipo>(<escopo>): <descrição no imperativo, minúscula, sem ponto>`.

O CONTRIBUTING lista só os nomes; a coluna da direita é a leitura de uso comum neste repositório.

| Escopo | Para |
|---|---|
| `api` | backend: rotas, schemas, services |
| `web` | frontend: telas, componentes, estilos |
| `db` | models, migrações, seed |
| `offline` | service worker, cache, sincronização |
| `infra` | Docker, deploy, configuração de ambiente |
| `docs` | documentação |

Tipos: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `ci`. Commit de `ci` vai sem escopo (ex.: `ci: roda migrações no job do backend`).
