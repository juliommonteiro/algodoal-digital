/**
 * Cliente de mentira com a mesma interface do real (ClienteApi), para o front andar
 * antes dos endpoints da S5. Ligado por VITE_USAR_MOCK (ver .env.example).
 *
 * Os dados espelham o seed do backend (backend/scripts/seed.py) — mesmos nomes, mesmas
 * coordenadas, mesmo ponto de carroças: trocar VITE_USAR_MOCK não muda o que aparece na tela.
 * São TODOS FICTÍCIOS:
 * nomes inventados, telefones na faixa reservada (91) 95555-XXXX, e-mails @example.com e
 * coordenadas apenas plausíveis para a Ilha de Maiandeua.
 */
import { ErroApi, obterTokenAcesso } from './api'
import { idsDaArvore } from './categorias'
import type {
  Categoria,
  LocalAdmin,
  ClienteApi,
  Local,
  Negocio,
  PerfilCarroceiro,
  RespostaLogin,
  StatusPedido,
  TipoLocal,
  Usuario,
} from './tipos'

let atrasoMs = 300

/** Os testes zeram o atraso; o app usa os 300ms para a tela de carregamento aparecer. */
export function configurarMock(opcoes: { atrasoMs: number }): void {
  atrasoMs = opcoes.atrasoMs
}

export function responder<T>(valor: T): Promise<T> {
  // structuredClone: quem recebe pode mexer no objeto sem estragar o "banco" do mock.
  return new Promise((resolve) => setTimeout(() => resolve(structuredClone(valor)), atrasoMs))
}

export function falhar(
  status: number,
  mensagem: string,
  campos: Record<string, string> = {},
): Promise<never> {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new ErroApi(status, mensagem, campos)), atrasoMs),
  )
}

// ---------------------------------------------------------------------------
// Categorias: árvore da seção 7 do PRD (estrutura real, não fictícia)
// ---------------------------------------------------------------------------

const ARVORE: { slug: string; name: string; icon: string; filhas: [string, string, string][] }[] = [
  {
    slug: 'turismo',
    name: 'Turismo',
    icon: 'compass',
    filhas: [
      ['praias', 'Praias', 'waves'],
      ['trilhas', 'Trilhas', 'footprints'],
      ['pontos-turisticos', 'Pontos turísticos', 'camera'],
      ['experiencias', 'Experiências', 'sparkles'],
    ],
  },
  {
    slug: 'alimentacao',
    name: 'Alimentação',
    icon: 'utensils',
    filhas: [
      ['restaurantes', 'Restaurantes', 'utensils'],
      ['lanchonetes', 'Lanchonetes', 'sandwich'],
      ['barracas', 'Barracas', 'umbrella'],
    ],
  },
  {
    slug: 'hospedagem',
    name: 'Hospedagem',
    icon: 'bed',
    filhas: [
      ['pousadas', 'Pousadas', 'bed'],
      ['hospedagens', 'Hospedagens', 'home'],
    ],
  },
  {
    slug: 'servicos',
    name: 'Serviços',
    icon: 'wrench',
    filhas: [
      ['carroceiros', 'Carroceiros', 'truck'],
      ['guias', 'Guias', 'map'],
      ['outros', 'Outros', 'dots'],
    ],
  },
  {
    slug: 'cultura',
    name: 'Cultura',
    icon: 'music',
    filhas: [
      ['artesanato', 'Artesanato', 'scissors'],
      ['cultura-local', 'Cultura local', 'music'],
      ['eventos', 'Eventos', 'calendar'],
    ],
  },
  {
    slug: 'preservacao',
    name: 'Preservação',
    icon: 'leaf',
    filhas: [
      ['pontos-de-coleta', 'Pontos de coleta', 'recycle'],
      ['missoes-ambientais', 'Missões ambientais', 'leaf'],
    ],
  },
]

function uuid(grupo: 'a' | 'b' | 'c' | 'd', n: number): string {
  return `00000000-0000-4000-${grupo}000-${String(n).padStart(12, '0')}`
}

function montarCategorias(): Categoria[] {
  const lista: Categoria[] = []
  let n = 1
  ARVORE.forEach((raiz, ordemRaiz) => {
    const idRaiz = uuid('a', n++)
    lista.push({
      id: idRaiz,
      slug: raiz.slug,
      name: raiz.name,
      icon: raiz.icon,
      parent_id: null,
      sort_order: ordemRaiz,
    })
    raiz.filhas.forEach(([slug, name, icon], ordem) => {
      lista.push({ id: uuid('a', n++), slug, name, icon, parent_id: idRaiz, sort_order: ordem })
    })
  })
  return lista
}


// ---------------------------------------------------------------------------
// Locais e estabelecimentos (os mesmos do catálogo inicial do seed)
// ---------------------------------------------------------------------------

const SEMANA_POUSADA: Record<string, [string, string][]> = {
  seg: [['07:00', '21:00']],
  ter: [['07:00', '21:00']],
  qua: [['07:00', '21:00']],
  qui: [['07:00', '21:00']],
  sex: [['07:00', '22:00']],
  sab: [['07:00', '22:00']],
  dom: [['07:00', '21:00']],
}

type DefinicaoLocal = [
  nome: string,
  kind: TipoLocal,
  categoria: string,
  latitude: number,
  longitude: number,
  descricao: string,
  negocio?: Negocio,
]

const DEFINICOES: DefinicaoLocal[] = [
  ['Praia do Cajueiro Torto', 'beach', 'praias', -0.5795, -47.5796,
    'Faixa de areia larga, boa para banho na maré baixa.'],
  ['Praia da Maré Virada', 'beach', 'praias', -0.6076, -47.58195,
    'Mar aberto e vento constante à tarde.'],
  ['Praia do Sol Deitado', 'beach', 'praias', -0.625, -47.5406,
    'Trecho tranquilo, sem estrutura.'],
  ['Trilha do Vento Sul', 'trail', 'trilhas', -0.5855, -47.5805,
    'Cerca de 40 minutos entre o campo e o mangue.'],
  ['Trilha das Dunas Claras', 'trail', 'trilhas', -0.6038, -47.583,
    'Percurso curto sobre dunas fixas.'],
  ['Mirante da Pedra Lisa', 'tourist_point', 'pontos-turisticos', -0.5879, -47.5868,
    'Ponto alto com vista para a foz.'],
  ['Passeio de Canoa ao Entardecer', 'experience', 'experiencias', -0.5966, -47.5842,
    'Saída de canoa pelo furo, com guia local.'],
  ['Roda de Carimbó do Terreiro Velho', 'culture', 'cultura-local', -0.5915, -47.5852,
    'Roda aberta aos sábados na praça.'],
  ['Ponto de Coleta Boca da Mata', 'collection_point', 'pontos-de-coleta', -0.595, -47.5816,
    'Recebe vidro, plástico e alumínio.'],
  ['Ponto de Carroças', 'tourist_point', 'carroceiros', -0.599, -47.5866,
    'Onde as carroças esperam quem chega pelo trapiche.'],
  ['Pousada Maré Mansa', 'business', 'pousadas', -0.5894, -47.5878,
    'Dez quartos com rede na varanda.',
    {
      whatsapp: '(91) 95555-0101',
      phone: '(91) 95555-0101',
      opening_hours: SEMANA_POUSADA,
      price_range: '$$',
      services: ['café da manhã', 'wi-fi', 'rede na varanda'],
      is_partner: true,
    }],
  ['Pousada Rede de Areia', 'business', 'pousadas', -0.5934, -47.5838,
    'Hospedagem simples de frente para o campo.',
    {
      whatsapp: '(91) 95555-0102',
      phone: null,
      opening_hours: { seg: [['08:00', '20:00']], sab: [['08:00', '20:00']] },
      price_range: '$',
      services: ['ventilador', 'estacionamento de bicicleta'],
      is_partner: false,
    }],
  ['Restaurante Vento Sul', 'business', 'restaurantes', -0.5906, -47.587,
    'Peixe frito e camarão no almoço.',
    {
      whatsapp: '(91) 95555-0103',
      phone: '(91) 95555-0103',
      opening_hours: {
        ter: [['11:00', '16:00']],
        qua: [['11:00', '16:00']],
        qui: [['11:00', '16:00']],
        sex: [['11:00', '22:00']],
        sab: [['11:00', '22:00']],
        dom: [['11:00', '17:00']],
      },
      price_range: '$$',
      services: ['peixe frito', 'camarão', 'opção vegetariana'],
      is_partner: true,
    }],
  ['Lanchonete Caju Verde', 'business', 'lanchonetes', -0.5926, -47.5876,
    'Açaí, tapioca e suco de cupuaçu.',
    {
      whatsapp: '(91) 95555-0104',
      phone: null,
      opening_hours: { seg: [['15:00', '22:00']], dom: [['15:00', '22:00']] },
      price_range: '$',
      services: ['açaí', 'tapioca', 'suco'],
      is_partner: false,
    }],
  ['Barraca do Peixe Dourado', 'business', 'barracas', -0.594, -47.5884,
    'Barraca de praia com cadeiras e petiscos.',
    {
      whatsapp: '(91) 95555-0105',
      phone: null,
      opening_hours: { sab: [['09:00', '18:00']], dom: [['09:00', '18:00']] },
      price_range: '$',
      services: ['petiscos', 'cadeira e guarda-sol'],
      is_partner: false,
    }],
  ['Ateliê Linha da Maré', 'business', 'artesanato', -0.5896, -47.5848,
    'Peças de palha e crochê feitas na hora.',
    {
      whatsapp: '(91) 95555-0106',
      phone: null,
      opening_hours: { qui: [['09:00', '17:00']], sex: [['09:00', '17:00']] },
      price_range: '$$',
      services: ['palha', 'crochê', 'encomenda'],
      is_partner: true,
    }],
]

const ATUALIZADO_EM = '2026-09-22T18:30:00Z'

/** Como o banco guarda: com o que o público não vê (remoção, origem, dono). */
export type LocalDoMock = LocalAdmin

// Mesmo dono do seed (BUSINESSES, owner_email).
const DONOS: Record<string, string> = { 'Pousada Maré Mansa': 'celia.parceira@example.com' }

function montarLocais(categorias: Categoria[]): LocalDoMock[] {
  const idCategoria = (slug: string): string => {
    const categoria = categorias.find((c) => c.slug === slug)
    if (!categoria) throw new Error(`categoria do mock inexistente: ${slug}`)
    return categoria.id
  }
  return DEFINICOES.map(
    ([name, kind, categoria, latitude, longitude, description, business], i) => ({
      id: uuid('b', i + 1),
      name,
      description,
      kind,
      category_id: idCategoria(categoria),
      latitude,
      longitude,
      is_published: true,
      updated_at: ATUALIZADO_EM,
      business: business ? { ...business, owner_email: DONOS[name] ?? null } : null,
      photos: [],
      deleted_at: null,
      source: 'campo' as const,
      created_at: ATUALIZADO_EM,
    }),
  )
}

// Montados na primeira chamada, não no import: o topo do módulo fica sem efeito colateral e
// o bundler consegue tirar o mock inteiro do build quando VITE_USAR_MOCK=false.
/** Perfil de carroceiro do mock, ligado ao usuário (como carriers.user_id). */
export interface CarroceiroDoMock extends PerfilCarroceiro {
  user_id: string
  is_approved: boolean
}

/** Pedido de carroça do mock, com o que o servidor guarda (ride_requests). */
export interface PedidoDoMock {
  id: string
  tourist_id: string
  tourist_name: string
  tourist_whatsapp: string
  carrier_user_id: string | null
  origin: string
  destination: string
  passengers: number
  notes: string | null
  status: StatusPedido
  created_at: string
  responded_at: string | null
}

interface BancoDoMock {
  categorias: Categoria[]
  locais: LocalDoMock[]
  usuarios: Usuario[]
  carroceiros: CarroceiroDoMock[]
  pedidos: PedidoDoMock[]
  /** `${pedido}:${usuario}` de quem recusou. */
  recusas: Set<string>
}

let dados: BancoDoMock | null = null

function banco(): BancoDoMock {
  if (!dados) {
    const categorias = montarCategorias()
    dados = {
      categorias,
      locais: montarLocais(categorias),
      usuarios: montarUsuarios(),
      carroceiros: montarCarroceiros(),
      pedidos: [],
      recusas: new Set(),
    }
  }
  return dados
}

/** Testes: volta aos dados do seed (o painel muda o "banco" do mock). */
export function reiniciarBancoDoMock(): void {
  dados = null
}

/** Para o painel administrativo no modo mock (src/admin/): o mesmo "banco", mutável — o que
 * o admin cria ou remove aparece (ou some) no mapa público. */
export function bancoDoMock() {
  return banco()
}

/** O público não vê o que só o painel vê. */
export function publico(local: LocalDoMock): Local {
  const { deleted_at: _d, source: _s, created_at: _c, business, ...visivel } = local
  if (!business) return { ...visivel, business: null }
  const { owner_email: _o, ...negocio } = business
  return { ...visivel, business: negocio }
}

const visivelAoPublico = (l: LocalDoMock) => l.is_published && l.deleted_at === null

// ---------------------------------------------------------------------------
// Usuários e autenticação de mentira
// ---------------------------------------------------------------------------

/** Mesmo critério que o cadastro exige no cliente. */
const SENHA_MINIMA = 8

function montarUsuarios(): Usuario[] {
  return [
  // Contas de teste do seed (README, "Contas de teste")
  { id: uuid('c', 7), name: 'Admin de Teste', email: 'admin@example.com', role: 'admin' },
  { id: uuid('c', 8), name: 'Turista de Teste', email: 'turista@example.com', role: 'tourist' },
  { id: uuid('c', 9), name: 'Carroceiro de Teste', email: 'carroceiro@example.com', role: 'carrier' },
  { id: uuid('c', 10), name: 'Parceiro de Teste', email: 'parceiro@example.com', role: 'partner' },
  { id: uuid('c', 1), name: 'Ana Viajante', email: 'ana.turista@example.com', role: 'tourist' },
  { id: uuid('c', 2), name: 'Bento Carroça', email: 'bento.carroceiro@example.com', role: 'carrier' },
  { id: uuid('c', 3), name: 'Célia Parceira', email: 'celia.parceira@example.com', role: 'partner' },
  { id: uuid('c', 4), name: 'Davi Gestor', email: 'davi.admin@example.com', role: 'admin' },
  { id: uuid('c', 5), name: 'Rosa Condutora', email: 'rosa.carroceira@example.com', role: 'carrier' },
  { id: uuid('c', 6), name: 'Tião Boiadeiro', email: 'tiao.carroceiro@example.com', role: 'carrier' },
  ]
}

// Mesmos perfis do seed (CARRIERS e a conta de teste). Tião não está aprovado.
function montarCarroceiros(): CarroceiroDoMock[] {
  const perfil = (
    n: number,
    display_name: string,
    whatsapp: string,
    capacity: number,
    is_available: boolean,
    is_approved = true,
  ): CarroceiroDoMock => ({
    user_id: uuid('c', n),
    display_name,
    whatsapp,
    capacity,
    is_available,
    is_approved,
  })
  return [
    perfil(9, 'Carroça de Teste', '(91) 95555-0209', 4, true),
    perfil(2, 'Carroça do Bento', '(91) 95555-0202', 4, true),
    perfil(5, 'Carroça da Rosa', '(91) 95555-0205', 2, false),
    perfil(6, 'Carroça do Tião', '(91) 95555-0206', 6, true, false),
  ]
}

// Quem se cadastra no mock fica só em memória; o refresh token carrega o próprio usuário,
// então a sessão continua válida depois de recarregar a página.
const cadastrados: Usuario[] = []

function codificar(usuario: Usuario): string {
  return btoa(encodeURIComponent(JSON.stringify(usuario)))
}

function decodificar(token: string, prefixo: string): Usuario | null {
  if (!token.startsWith(prefixo)) return null
  try {
    const usuario = JSON.parse(decodeURIComponent(atob(token.slice(prefixo.length)))) as Usuario
    return usuario && typeof usuario.id === 'string' && typeof usuario.email === 'string'
      ? usuario
      : null
  } catch {
    return null
  }
}

let serie = 0

/** Dono do token de acesso do mock, como o `usuario_atual` da API. Usado também pela carroça. */
export function usuarioDaSessaoMock(): Usuario | null {
  const token = obterTokenAcesso() ?? ''
  const [, , carga] = token.split('.')
  return token.startsWith('mock-acesso.') && carga ? decodificar(carga, '') : null
}

function sessao(usuario: Usuario): RespostaLogin {
  serie += 1
  return {
    access_token: `mock-acesso.${serie}.${codificar(usuario)}`,
    refresh_token: `mock-refresh.${codificar(usuario)}`,
    token_type: 'bearer',
    user: usuario,
  }
}

/** A conta (mutável) do mock com esse e-mail, inclusive as cadastradas na sessão. */
export function contaDoMock(email: string): Usuario | undefined {
  return buscarPorEmail(email)
}

function buscarPorEmail(email: string): Usuario | undefined {
  const alvo = email.trim().toLowerCase()
  return [...banco().usuarios, ...cadastrados].find((u) => u.email === alvo)
}

// ---------------------------------------------------------------------------

export const clienteMock: ClienteApi = {
  registrar(nome, email, senha, carroceiro) {
    if (buscarPorEmail(email)) return falhar(409, 'Já existe uma conta com esse e-mail.')
    if (senha.length < SENHA_MINIMA) {
      return falhar(422, `A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`)
    }
    const usuario: Usuario = {
      id: crypto.randomUUID(),
      name: nome.trim(),
      email: email.trim().toLowerCase(),
      role: carroceiro ? 'carrier' : 'tourist',
    }
    cadastrados.push(usuario)
    if (carroceiro) {
      banco().carroceiros.push({
        user_id: usuario.id,
        display_name: usuario.name,
        whatsapp: carroceiro.whatsapp,
        capacity: carroceiro.capacity,
        is_available: true,
        is_approved: true,
      })
    }
    return responder(sessao(usuario))
  },

  entrar(email, senha) {
    const usuario = buscarPorEmail(email)
    if (!usuario || senha.length < SENHA_MINIMA) {
      return falhar(401, 'E-mail ou senha incorretos.')
    }
    return responder(sessao(usuario))
  },

  renovar(refreshToken) {
    const usuario = decodificar(refreshToken, 'mock-refresh.')
    if (!usuario) return falhar(401, 'Sessão expirada. Entre de novo.')
    return responder(sessao(usuario))
  },

  eu() {
    const usuario = usuarioDaSessaoMock()
    if (!usuario) return falhar(401, 'Não autenticado.')
    return responder(usuario)
  },

  categorias() {
    return responder(banco().categorias)
  },

  locais(filtros) {
    const { categorias, locais } = banco()
    let lista = locais.filter(visivelAoPublico)
    if (filtros?.category) {
      const raiz = categorias.find((c) => c.slug === filtros.category)
      const ids = raiz ? idsDaArvore(categorias, raiz.id) : new Set<string>()
      lista = lista.filter((l) => ids.has(l.category_id))
    }
    if (filtros?.kind) lista = lista.filter((l) => l.kind === filtros.kind)
    return responder(lista.map(publico))
  },

  local(id) {
    const encontrado = banco().locais.find((l) => l.id === id && visivelAoPublico(l))
    return encontrado ? responder(publico(encontrado)) : falhar(404, 'Local não encontrado.')
  },
}
