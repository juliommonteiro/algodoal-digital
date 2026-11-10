/**
 * Contrato entre o PWA e a API (/api/v1). Deriva dos models da S4
 * (backend/app/models/). Mudou aqui, mude lá — e vice-versa.
 */

export type Perfil = 'tourist' | 'carrier' | 'partner' | 'admin'
export type TipoLocal =
  | 'beach'
  | 'trail'
  | 'tourist_point'
  | 'experience'
  | 'business'
  | 'collection_point'
  | 'culture'

export interface Usuario {
  id: string
  name: string
  email: string
  role: Perfil
}

/**
 * Perfil de carroceiro enviado no cadastro (`carrier` em POST /auth/register). Com ele a conta
 * nasce carroceiro, já aprovada; sem ele, turista. Backend: CarroceiroIn.
 */
export interface DadosCarroceiro {
  whatsapp: string
  /** Pessoas por viagem, de 1 a 12. */
  capacity: number
}

export interface Categoria {
  id: string
  slug: string
  name: string
  icon: string | null
  parent_id: string | null
  sort_order: number
}

export interface Negocio {
  whatsapp: string | null
  phone: string | null
  /** {"seg": [["09:00", "22:00"]], ...}; dia ausente = fechado. */
  opening_hours: Record<string, [string, string][]> | null
  price_range: string | null
  services: string[]
  is_partner: boolean
}

export interface Foto {
  id: string
  storage_key: string
  position: number
}

export interface Local {
  id: string
  name: string
  description: string | null
  kind: TipoLocal
  category_id: string
  latitude: number
  longitude: number
  is_published: boolean
  updated_at: string
  business: Negocio | null
  photos: Foto[]
}

export interface RespostaLogin {
  access_token: string
  refresh_token: string
  token_type: 'bearer'
  user: Usuario
}

/**
 * Filtros de GET /places. `category` é o slug e inclui as subcategorias
 * (category=alimentacao traz restaurantes, lanchonetes e barracas).
 */
export interface FiltrosLocais {
  category?: string
  kind?: TipoLocal
}

// ---------------------------------------------------------------------------
// Carroça (/api/v1/ride-requests, /carriers, /carrier; S10, #32 e #33)
// ---------------------------------------------------------------------------

export type StatusPedido = 'pending' | 'accepted' | 'declined' | 'cancelled' | 'expired'

/** Corpo de POST /ride-requests. Backend: PedidoIn. */
export interface PedidoEntrada {
  origin: string
  destination: string
  passengers: number
  /** Horário e observações num texto só ("Agora · duas malas grandes"). */
  notes: string | null
  /** Do turista: só o carroceiro que aceitar vê. */
  whatsapp: string
}

/** O pedido como o turista vê: o carroceiro aparece depois do aceite. */
export interface PedidoDoTurista {
  id: string
  origin: string
  destination: string
  passengers: number
  notes: string | null
  status: StatusPedido
  created_at: string
  expires_at: string
  responded_at: string | null
  carrier: { display_name: string; whatsapp: string | null } | null
}

/** O pedido como o carroceiro vê: o WhatsApp do turista só para quem aceitou. */
export interface PedidoParaCarroceiro {
  id: string
  origin: string
  destination: string
  passengers: number
  notes: string | null
  status: StatusPedido
  created_at: string
  expires_at: string
  responded_at: string | null
  tourist_name: string
  tourist_whatsapp: string | null
}

export interface PerfilCarroceiro {
  display_name: string
  whatsapp: string | null
  capacity: number
  is_available: boolean
}

/** GET /carriers: para chamar direto pelo WhatsApp, inclusive sem internet. */
export type ContatoCarroceiro = PerfilCarroceiro

export interface ClienteCarroca {
  pedir(pedido: PedidoEntrada): Promise<PedidoDoTurista>
  /** null quando não há pedido recente (a API responde 204). */
  pedidoAtual(): Promise<PedidoDoTurista | null>
  cancelar(id: string): Promise<PedidoDoTurista>
  contatos(): Promise<ContatoCarroceiro[]>
  meuPerfil(): Promise<PerfilCarroceiro>
  atualizarPerfil(
    mudancas: Partial<Pick<PerfilCarroceiro, 'is_available' | 'capacity' | 'whatsapp'>>,
  ): Promise<PerfilCarroceiro>
  pedidosAbertos(): Promise<PedidoParaCarroceiro[]>
  aceitar(id: string): Promise<PedidoParaCarroceiro>
  recusar(id: string): Promise<void>
  viagens(): Promise<PedidoParaCarroceiro[]>
}

// ---------------------------------------------------------------------------
// Painel do parceiro (/api/v1/partner, #26)
// ---------------------------------------------------------------------------

/** PATCH /partner/places/{id}: só o que vier muda. Nome, categoria e posição são do admin. */
export interface NegocioDoParceiroEntrada {
  description?: string | null
  is_published?: boolean
  whatsapp?: string | null
  phone?: string | null
  opening_hours?: Record<string, [string, string][]> | null
  price_range?: '$' | '$$' | '$$$' | null
  services?: string[]
}

export interface ClienteParceiro {
  /** Os estabelecimentos desta conta, inclusive os fora do mapa. */
  meus(): Promise<Local[]>
  atualizar(id: string, mudancas: NegocioDoParceiroEntrada): Promise<Local>
}

/** O que o cliente real (api.ts) e o mock (mock.ts) implementam. */
export interface ClienteApi {
  registrar(
    nome: string,
    email: string,
    senha: string,
    carroceiro?: DadosCarroceiro,
  ): Promise<RespostaLogin>
  entrar(email: string, senha: string): Promise<RespostaLogin>
  renovar(refreshToken: string): Promise<RespostaLogin>
  eu(): Promise<Usuario>
  categorias(): Promise<Categoria[]>
  locais(filtros?: FiltrosLocais): Promise<Local[]>
  local(id: string): Promise<Local>
}

// ---------------------------------------------------------------------------
// Painel administrativo (/api/v1/admin, S6). Só tipos: não pesam no bundle.
// ---------------------------------------------------------------------------

export type StatusAdmin = 'publicado' | 'rascunho' | 'removido'
export type Origem = 'ficticio' | 'campo' | 'osm'

/** O local como o painel vê: com o que o público não vê. */
/** Dados comerciais como o painel admin vê: com o dono, que o público não vê. */
export interface NegocioAdmin extends Negocio {
  /** Conta que edita pelo painel do parceiro (#26). */
  owner_email: string | null
}

export interface LocalAdmin extends Local {
  deleted_at: string | null
  source: Origem
  created_at: string
  business: NegocioAdmin | null
}

export interface NegocioEntrada {
  whatsapp: string | null
  phone: string | null
  opening_hours: Record<string, [string, string][]> | null
  price_range: '$' | '$$' | '$$$' | null
  services: string[]
  is_partner: boolean
  /** A conta precisa existir; se for de turista, vira parceira. null = sem dono. */
  owner_email: string | null
}

/** Corpo de POST /admin/places e de PATCH (que aceita só parte). */
export interface LocalEntrada {
  name: string
  description: string | null
  kind: TipoLocal
  category_id: string
  latitude: number
  longitude: number
  is_published: boolean
  /** null remove os dados comerciais; um objeto os substitui. */
  business: NegocioEntrada | null
}

export interface FiltrosAdmin {
  category?: string
  kind?: TipoLocal
  status?: StatusAdmin
}

export interface ClienteAdmin {
  locais(filtros?: FiltrosAdmin): Promise<LocalAdmin[]>
  local(id: string): Promise<LocalAdmin>
  criar(dados: LocalEntrada): Promise<LocalAdmin>
  atualizar(id: string, dados: Partial<LocalEntrada>): Promise<LocalAdmin>
  remover(id: string): Promise<LocalAdmin>
  restaurar(id: string): Promise<LocalAdmin>
  categorias(): Promise<Categoria[]>
}
