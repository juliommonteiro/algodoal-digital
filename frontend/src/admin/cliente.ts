/**
 * Cliente do painel (/api/v1/admin). Fica aqui, e não em lib/api.ts, para ir no chunk do painel:
 * nada disto entra no bundle do turista nem no precache.
 */
import { requisitar } from '../lib/api'
import { idsDaArvore } from '../lib/categorias'
import { erroDeLatitude, erroDeLongitude } from '../lib/areaDoMapa'
import { usandoMock } from '../lib/cliente'
import { bancoDoMock, contaDoMock, falhar, responder } from '../lib/mock'
import type {
  Categoria,
  ClienteAdmin,
  FiltrosAdmin,
  Indicadores,
  LocalAdmin,
  LocalEntrada,
  NegocioAdmin,
  NegocioEntrada,
  StatusAdmin,
  Usuario,
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
  indicadores: () => requisitar<Indicadores>('GET', '/admin/indicators'),
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

const PERFIL: Partial<Record<Usuario['role'], string>> = { carrier: 'carroceiro', admin: 'admin' }

/** Mesmas regras da API (admin_catalog._dono): turista vira parceiro, outro perfil não pode. */
function erroDoDono(dados: Partial<LocalEntrada>): Record<string, string> {
  const email = dados.business?.owner_email
  if (!email) return {}
  const conta = contaDoMock(email)
  if (!conta) {
    return {
      'business.owner_email':
        'Não há conta com esse e-mail. Peça para a pessoa criar a conta no app primeiro.',
    }
  }
  const perfil = PERFIL[conta.role]
  if (perfil) {
    return {
      'business.owner_email': `Esta conta é de ${perfil}. O dono precisa ser uma conta de turista (que vira parceira) ou de parceiro.`,
    }
  }
  return {}
}

/** Liga o dono novo (vira parceiro) e rebaixa o antigo se ele ficou sem estabelecimento. */
function trocarDono(antigo: string | null, novo: string | null): void {
  const email = (valor: string | null) => valor?.trim().toLowerCase() ?? null
  const contaNova = novo ? contaDoMock(novo) : undefined
  if (contaNova) contaNova.role = 'partner'
  const contaAntiga = antigo ? contaDoMock(antigo) : undefined
  if (!contaAntiga || contaAntiga === contaNova || contaAntiga.role !== 'partner') return
  const aindaDono = bancoDoMock().locais.some(
    (l) => email(l.business?.owner_email ?? null) === contaAntiga.email,
  )
  if (!aindaDono) contaAntiga.role = 'tourist'
}

function negocioComDono(negocio: NegocioEntrada | null): NegocioAdmin | null {
  if (!negocio) return null
  const owner_email = negocio.owner_email?.trim().toLowerCase() || null
  return { ...negocio, owner_email }
}

export const clienteAdminMock: ClienteAdmin = {
  // Mesmas contas da API (services/indicadores.py), sobre o "banco" do mock.
  indicadores() {
    const { usuarios, locais, carroceiros, pedidos } = bancoDoMock()
    const agora = Date.now()
    const semana = pedidos.filter((p) => Date.parse(p.created_at) >= agora - 7 * 86_400_000)
    const aceitos = semana.filter((p) => p.status === 'accepted')
    const vencidos = semana.filter((p) => p.status === 'expired')
    const minutos = aceitos
      .filter((p) => p.responded_at)
      .map((p) => (Date.parse(p.responded_at!) - Date.parse(p.created_at)) / 60_000)
    const perfil = (role: string) => usuarios.filter((u) => u.role === role).length
    const vivos = locais.filter((l) => !l.deleted_at)
    const hoje = new Date().toDateString()
    return responder<Indicadores>({
      gerado_em: new Date().toISOString(),
      usuarios: {
        total: usuarios.length,
        ativos_30_dias: 0, // o mock não guarda sessões
        turistas: perfil('tourist'),
        carroceiros: perfil('carrier'),
        parceiros: perfil('partner'),
        admins: perfil('admin'),
      },
      locais: {
        publicados: vivos.filter((l) => l.is_published).length,
        rascunhos: vivos.filter((l) => !l.is_published).length,
        removidos: locais.length - vivos.length,
        estabelecimentos: vivos.filter((l) => l.business).length,
        // owner_email chega com o painel do parceiro (#60); antes dele, ninguém tem dono.
        estabelecimentos_com_dono: vivos.filter(
          (l) => (l.business as { owner_email?: string | null } | null)?.owner_email,
        ).length,
        com_foto: vivos.filter((l) => l.photos.length).length,
      },
      carroceiros: {
        total: carroceiros.filter((c) => c.is_approved).length,
        disponiveis: carroceiros.filter((c) => c.is_approved && c.is_available).length,
      },
      pedidos: {
        total: pedidos.length,
        ultimos_7_dias: semana.length,
        aceitos_7_dias: aceitos.length,
        taxa_de_aceite_7_dias:
          aceitos.length + vencidos.length
            ? aceitos.length / (aceitos.length + vencidos.length)
            : null,
        minutos_ate_aceite_7_dias: minutos.length
          ? Math.round((minutos.reduce((a, b) => a + b, 0) / minutos.length) * 10) / 10
          : null,
      },
      pedidos_de_hoje: pedidos
        .filter((p) => new Date(p.created_at).toDateString() === hoje)
        .reverse()
        .map(({ id, origin, destination, passengers, status, created_at }) => ({
          id,
          origin,
          destination,
          passengers,
          status,
          created_at,
        })),
    })
  },

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
    const erros = { ...errosDoMock(dados, banco.categorias), ...erroDoDono(dados) }
    if (Object.keys(erros).length) return recusar(erros)
    const agora = new Date().toISOString()
    const local: LocalAdmin = {
      ...dados,
      business: negocioComDono(dados.business),
      id: crypto.randomUUID(),
      name: dados.name.trim(),
      photos: [],
      updated_at: agora,
      created_at: agora,
      deleted_at: null,
      source: 'campo',
    }
    banco.locais.push(local)
    trocarDono(null, local.business?.owner_email ?? null)
    return responder(local)
  },

  atualizar(localId, dados) {
    const banco = bancoDoMock()
    const local = banco.locais.find((l) => l.id === localId)
    if (!local) return falhar(404, 'Local não encontrado.')
    const erros = { ...errosDoMock(dados, banco.categorias), ...erroDoDono(dados) }
    if (Object.keys(erros).length) return recusar(erros)
    const antigo = local.business?.owner_email ?? null
    const { business, ...resto } = dados
    Object.assign(local, resto, { updated_at: new Date().toISOString() })
    if (business !== undefined) {
      local.business = negocioComDono(business)
      trocarDono(antigo, local.business?.owner_email ?? null)
    }
    return responder(local)
  },

  remover(localId) {
    const local = bancoDoMock().locais.find((l) => l.id === localId)
    if (!local) return falhar(404, 'Local não encontrado.')
    if (!local.deleted_at) {
      local.deleted_at = new Date().toISOString()
      local.updated_at = local.deleted_at
    }
    return responder(local)
  },

  restaurar(localId) {
    const local = bancoDoMock().locais.find((l) => l.id === localId)
    if (!local) return falhar(404, 'Local não encontrado.')
    local.deleted_at = null
    local.updated_at = new Date().toISOString()
    return responder(local)
  },

  categorias() {
    return responder(bancoDoMock().categorias)
  },
}

export const apiAdmin: ClienteAdmin = usandoMock ? clienteAdminMock : clienteAdminHttp
