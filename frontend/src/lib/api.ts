import type {
  Categoria,
  ClienteApi,
  FiltrosLocais,
  Local,
  RespostaLogin,
  Usuario,
} from './tipos'

const BASE_URL = import.meta.env.VITE_API_URL ?? ''
const PREFIXO = '/api/v1'

/** Status usado quando nem chegou resposta (sem rede, DNS, CORS, servidor fora). */
export const SEM_REDE = 0

/** Todo erro que sai do cliente é um ErroApi: a tela nunca recebe o erro cru do fetch. */
export class ErroApi extends Error {
  readonly status: number
  readonly mensagem: string

  constructor(status: number, mensagem: string) {
    super(mensagem)
    this.name = 'ErroApi'
    this.status = status
    this.mensagem = mensagem
  }

  get semRede(): boolean {
    return this.status === SEM_REDE
  }
}

// O token de acesso vive só em memória; quem guarda o refresh token é o AuthContext.
let tokenAcesso: string | null = null

export function definirTokenAcesso(token: string | null): void {
  tokenAcesso = token
}

export function obterTokenAcesso(): string | null {
  return tokenAcesso
}

const MENSAGENS_PADRAO: Record<number, string> = {
  400: 'Pedido inválido.',
  401: 'E-mail ou senha incorretos, ou a sessão expirou.',
  403: 'Você não tem permissão para isso.',
  404: 'Não encontrado.',
  409: 'Esse registro já existe.',
  422: 'Confira os dados enviados.',
  429: 'Muitas tentativas. Espere um pouco e tente de novo.',
}

async function mensagemDoErro(resposta: Response): Promise<string> {
  try {
    const corpo: unknown = await resposta.json()
    // FastAPI: {"detail": "texto"} ou {"detail": [{"msg": "..."}]} na validação.
    if (corpo && typeof corpo === 'object' && 'detail' in corpo) {
      const { detail } = corpo as { detail: unknown }
      if (typeof detail === 'string') return detail
      if (Array.isArray(detail) && typeof detail[0]?.msg === 'string') return detail[0].msg
    }
  } catch {
    // corpo vazio ou não-JSON: cai na mensagem padrão
  }
  if (resposta.status >= 500) return 'O servidor está com problema. Tente de novo em instantes.'
  return MENSAGENS_PADRAO[resposta.status] ?? `Erro ${resposta.status}.`
}

async function requisitar<T>(metodo: 'GET' | 'POST', caminho: string, corpo?: unknown): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (corpo !== undefined) headers['Content-Type'] = 'application/json'
  if (tokenAcesso) headers.Authorization = `Bearer ${tokenAcesso}`

  let resposta: Response
  try {
    resposta = await fetch(`${BASE_URL}${PREFIXO}${caminho}`, {
      method: metodo,
      headers,
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    })
  } catch {
    throw new ErroApi(SEM_REDE, 'Sem conexão com o servidor. Verifique a internet e tente de novo.')
  }

  if (!resposta.ok) throw new ErroApi(resposta.status, await mensagemDoErro(resposta))

  try {
    return (await resposta.json()) as T
  } catch {
    throw new ErroApi(resposta.status, 'Resposta inválida do servidor.')
  }
}

function consulta(filtros?: FiltrosLocais): string {
  const params = new URLSearchParams()
  if (filtros?.category) params.set('category', filtros.category)
  if (filtros?.kind) params.set('kind', filtros.kind)
  const texto = params.toString()
  return texto ? `?${texto}` : ''
}

export const clienteHttp: ClienteApi = {
  registrar: (nome, email, senha) =>
    requisitar<RespostaLogin>('POST', '/auth/register', { name: nome, email, password: senha }),
  entrar: (email, senha) =>
    requisitar<RespostaLogin>('POST', '/auth/login', { email, password: senha }),
  renovar: (refreshToken) =>
    requisitar<RespostaLogin>('POST', '/auth/refresh', { refresh_token: refreshToken }),
  eu: () => requisitar<Usuario>('GET', '/auth/me'),
  categorias: () => requisitar<Categoria[]>('GET', '/categories'),
  locais: (filtros) => requisitar<Local[]>('GET', `/places${consulta(filtros)}`),
  local: (id) => requisitar<Local>('GET', `/places/${encodeURIComponent(id)}`),
}
