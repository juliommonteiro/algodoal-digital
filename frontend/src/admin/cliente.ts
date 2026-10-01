/**
 * Cliente do painel (/api/v1/admin). Fica aqui, e não em lib/api.ts, para ir no chunk do painel:
 * nada disto entra no bundle do turista nem no precache.
 */
import { requisitar } from '../lib/api'
import { idsDaArvore } from '../lib/categorias'
import { erroDeLatitude, erroDeLongitude } from '../lib/areaDoMapa'
import { usandoMock } from '../lib/cliente'
import { bancoDoMock, falhar, responder } from '../lib/mock'
import type {
  Categoria,
  ClienteAdmin,
  FiltrosAdmin,
  LocalAdmin,
  LocalEntrada,
  StatusAdmin,
} from '../lib/tipos'

const id = encodeURIComponent

function consulta(filtros?: FiltrosAdmin): string {
  const params = new URLSearchParams()
  if (filtros?.category) params.set('category', filtros.category)
  if (filtros?.kind) params.set('kind', filtros.kind)
  if (filtros?.status) params.set('status', filtros.status)
  const texto = params.toString()
  return texto ? `?${texto}` : ''
}

/** Mesmo nome do runtimeCaching do catálogo em vite.config.ts. */
const CACHE_DO_CATALOGO = 'algodoal-catalogo-v1'
const DO_CATALOGO = /^\/api\/v1\/places(\/[0-9a-f-]{36})?$/

/**
 * Depois de uma mudança, tira do cache do service worker a lista pública e o detalhe do local.
 * Ele responde do cache primeiro (StaleWhileRevalidate): sem isto, quem acabou de salvar e
 * abre o mapa no mesmo aparelho ainda veria a versão anterior até a carga seguinte.
 * Melhor esforço: sem Cache API (http fora de localhost, testes), não faz nada.
 */
async function esquecerDoCachePublico(localId: string): Promise<void> {
  try {
    if (typeof caches === 'undefined' || !(await caches.has(CACHE_DO_CATALOGO))) return
    const cache = await caches.open(CACHE_DO_CATALOGO)
    for (const pedido of await cache.keys()) {
      const caminho = new URL(pedido.url).pathname
      const casa = caminho.match(DO_CATALOGO)
      if (casa && (!casa[1] || casa[1] === `/${localId}`)) await cache.delete(pedido)
    }
  } catch {
    // o cache é só uma otimização para o turista; o painel não depende dele
  }
}

async function eEsquecer(pedido: Promise<LocalAdmin>): Promise<LocalAdmin> {
  const local = await pedido
  await esquecerDoCachePublico(local.id)
  return local
}

export const clienteAdminHttp: ClienteAdmin = {
  locais: (filtros) => requisitar<LocalAdmin[]>('GET', `/admin/places${consulta(filtros)}`),
  local: (localId) => requisitar<LocalAdmin>('GET', `/admin/places/${id(localId)}`),
  criar: (dados) => eEsquecer(requisitar<LocalAdmin>('POST', '/admin/places', dados)),
  atualizar: (localId, dados) =>
    eEsquecer(requisitar<LocalAdmin>('PATCH', `/admin/places/${id(localId)}`, dados)),
  remover: (localId) => eEsquecer(requisitar<LocalAdmin>('DELETE', `/admin/places/${id(localId)}`)),
  restaurar: (localId) =>
    eEsquecer(requisitar<LocalAdmin>('POST', `/admin/places/${id(localId)}/restaurar`)),
  categorias: () => requisitar<Categoria[]>('GET', '/admin/categories'),
}

export function statusDoLocal(local: LocalAdmin): StatusAdmin {
  if (local.deleted_at) return 'removido'
  return local.is_published ? 'publicado' : 'rascunho'
}

// ---------------------------------------------------------------------------
// Mock: o mesmo "banco" do mock público, então o que o painel cria aparece no mapa.
// Imita as respostas da API, inclusive os erros por campo (422).
// ---------------------------------------------------------------------------

/** O que a API recusaria, no mesmo formato de ErroApi.campos. */
function errosDoMock(
  dados: Partial<LocalEntrada>,
  categorias: Categoria[],
): Record<string, string> {
  const erros: Record<string, string> = {}
  if (dados.name !== undefined && !dados.name?.trim()) erros.name = 'Informe o nome do local.'
  if (dados.latitude !== undefined) {
    const erro = erroDeLatitude(dados.latitude)
    if (erro) erros.latitude = erro
  }
  if (dados.longitude !== undefined) {
    const erro = erroDeLongitude(dados.longitude)
    if (erro) erros.longitude = erro
  }
  if (dados.category_id !== undefined && !categorias.some((c) => c.id === dados.category_id)) {
    erros.category_id = 'Categoria inexistente.'
  }
  return erros
}

function recusar(erros: Record<string, string>): Promise<never> {
  return falhar(422, Object.values(erros)[0], erros)
}

export const clienteAdminMock: ClienteAdmin = {
  locais(filtros) {
    const { categorias, locais } = bancoDoMock()
    let lista = locais
    if (filtros?.category) {
      const raiz = categorias.find((c) => c.slug === filtros.category)
      const ids = raiz ? idsDaArvore(categorias, raiz.id) : new Set<string>()
      lista = lista.filter((l) => ids.has(l.category_id))
    }
    if (filtros?.kind) lista = lista.filter((l) => l.kind === filtros.kind)
    if (filtros?.status) lista = lista.filter((l) => statusDoLocal(l) === filtros.status)
    return responder([...lista].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')))
  },

  local(localId) {
    const local = bancoDoMock().locais.find((l) => l.id === localId)
    return local ? responder(local) : falhar(404, 'Local não encontrado.')
  },

  criar(dados) {
    const banco = bancoDoMock()
    const erros = errosDoMock(dados, banco.categorias)
    if (Object.keys(erros).length) return recusar(erros)
    const agora = new Date().toISOString()
    const local: LocalAdmin = {
      ...dados,
      id: crypto.randomUUID(),
      name: dados.name.trim(),
      photos: [],
      updated_at: agora,
      created_at: agora,
      deleted_at: null,
      source: 'campo',
    }
    banco.locais.push(local)
    return responder(local)
  },

  atualizar(localId, dados) {
    const banco = bancoDoMock()
    const local = banco.locais.find((l) => l.id === localId)
    if (!local) return falhar(404, 'Local não encontrado.')
    const erros = errosDoMock(dados, banco.categorias)
    if (Object.keys(erros).length) return recusar(erros)
    Object.assign(local, dados, { updated_at: new Date().toISOString() })
    return responder(local)
  },

  remover(localId) {
    const local = bancoDoMock().locais.find((l) => l.id === localId)
    if (!local) return falhar(404, 'Local não encontrado.')
    local.deleted_at ??= new Date().toISOString()
    return responder(local)
  },

  restaurar(localId) {
    const local = bancoDoMock().locais.find((l) => l.id === localId)
    if (!local) return falhar(404, 'Local não encontrado.')
    local.deleted_at = null
    return responder(local)
  },

  categorias() {
    return responder(bancoDoMock().categorias)
  },
}

export const apiAdmin: ClienteAdmin = usandoMock ? clienteAdminMock : clienteAdminHttp
