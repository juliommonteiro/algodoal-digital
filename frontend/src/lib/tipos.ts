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

/** O que o cliente real (api.ts) e o mock (mock.ts) implementam. */
export interface ClienteApi {
  registrar(nome: string, email: string, senha: string): Promise<RespostaLogin>
  entrar(email: string, senha: string): Promise<RespostaLogin>
  renovar(refreshToken: string): Promise<RespostaLogin>
  eu(): Promise<Usuario>
  categorias(): Promise<Categoria[]>
  locais(filtros?: FiltrosLocais): Promise<Local[]>
  local(id: string): Promise<Local>
}
