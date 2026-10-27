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
const TEMPO_LIMITE_GET_MS = 8_000
const TEMPO_LIMITE_MUTACAO_MS = 12_000

/** Status usado quando nem chegou resposta (sem rede, DNS, CORS, servidor fora). */
export const SEM_REDE = 0

/** Todo erro que sai do cliente é um ErroApi: a tela nunca recebe o erro cru do fetch. */
export class ErroApi extends Error {
  readonly status: number
  readonly mensagem: string
  /** Erros de validação por campo (422), ex.: { latitude: "Fora da área do mapa…" }. */
  readonly campos: Record<string, string>
  readonly requestId: string | null

  constructor(
    status: number,
    mensagem: string,
    campos: Record<string, string> = {},
    requestId: string | null = null,
  ) {
    super(mensagem)
    this.name = 'ErroApi'
    this.status = status
    this.mensagem = mensagem
    this.campos = campos
    this.requestId = requestId
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

/** Erro de validação do FastAPI: loc ["body", "business", "whatsapp"] vira "business.whatsapp". */
function camposDoErro(detail: unknown[]): Record<string, string> {
  const campos: Record<string, string> = {}
  for (const item of detail) {
    const { loc, msg } = (item ?? {}) as { loc?: unknown; msg?: unknown }
    if (!Array.isArray(loc) || typeof msg !== 'string') continue
    const caminho = (loc[0] === 'body' ? loc.slice(1) : loc).join('.')
    if (caminho && !(caminho in campos)) campos[caminho] = msg
  }
  return campos
}

async function erroDaResposta(resposta: Response, requestId: string): Promise<ErroApi> {
  const correlacao = resposta.headers.get('x-request-id') ?? requestId
  try {
    const corpo: unknown = await resposta.json()
    // FastAPI: {"detail": "texto"} ou {"detail": [{"loc": [...], "msg": "..."}]} na validação.
    if (corpo && typeof corpo === 'object' && 'detail' in corpo) {
      const { detail } = corpo as { detail: unknown }
      if (typeof detail === 'string') return new ErroApi(resposta.status, detail, {}, correlacao)
      if (Array.isArray(detail) && typeof detail[0]?.msg === 'string') {
        return new ErroApi(resposta.status, detail[0].msg, camposDoErro(detail), correlacao)
      }
    }
  } catch {
    // corpo vazio ou não-JSON: cai na mensagem padrão
  }
  const mensagem =
    resposta.status >= 500
      ? 'O servidor está com problema. Tente de novo em instantes.'
      : (MENSAGENS_PADRAO[resposta.status] ?? `Erro ${resposta.status}.`)
  return new ErroApi(resposta.status, mensagem, {}, correlacao)
}

function novoRequestId(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export interface OpcoesRequisicao {
  tempoLimiteMs?: number
}

export async function requisitar<T>(
  metodo: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  caminho: string,
  corpo?: unknown,
  opcoes: OpcoesRequisicao = {},
): Promise<T> {
  const requestId = novoRequestId()
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-Request-ID': requestId,
  }
  if (corpo !== undefined) headers['Content-Type'] = 'application/json'
  if (tokenAcesso) headers.Authorization = `Bearer ${tokenAcesso}`

  const controlador = new AbortController()
  const tempoLimite =
    opcoes.tempoLimiteMs ?? (metodo === 'GET' ? TEMPO_LIMITE_GET_MS : TEMPO_LIMITE_MUTACAO_MS)
  const temporizador = globalThis.setTimeout(() => controlador.abort(), tempoLimite)
  let resposta: Response
  try {
    resposta = await fetch(`${BASE_URL}${PREFIXO}${caminho}`, {
      method: metodo,
      headers,
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
      signal: controlador.signal,
      cache: metodo === 'GET' ? 'no-store' : 'default',
    })
  } catch {
    if (controlador.signal.aborted) {
      throw new ErroApi(
        SEM_REDE,
        'O servidor demorou para responder. Você pode continuar usando os dados offline.',
        {},
        requestId,
      )
    }
    throw new ErroApi(
      SEM_REDE,
      'Sem conexão com o servidor. Verifique a internet e tente de novo.',
      {},
      requestId,
    )
  } finally {
    globalThis.clearTimeout(temporizador)
  }

  if (!resposta.ok) throw await erroDaResposta(resposta, requestId)
  try {
    return (await resposta.json()) as T
  } catch {
    throw new ErroApi(
      resposta.status,
      'Resposta inválida do servidor.',
      {},
      resposta.headers.get('x-request-id') ?? requestId,
    )
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
