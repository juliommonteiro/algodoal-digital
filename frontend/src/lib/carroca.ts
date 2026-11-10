/**
 * Cliente da carroça (#32 e #33): o turista pede e acompanha, o carroceiro aceita ou recusa.
 * O pedido vai para todos os carroceiros disponíveis com capacidade, e o primeiro que aceitar
 * leva (backend/app/services/carroca.py). Pedido de carroça não entra na Outbox: sem rede, a
 * tela mostra o WhatsApp dos carroceiros, guardado da última vez que houve conexão.
 */
import { garantirTokenDeAcesso, requisitar } from './api'
import { usandoMock } from './cliente'
import { bancoDoMock, falhar, responder, usuarioDaSessaoMock, type PedidoDoMock } from './mock'
import type {
  ClienteCarroca,
  ContatoCarroceiro,
  PedidoDoTurista,
  PedidoParaCarroceiro,
  PerfilCarroceiro,
} from './tipos'

/** Mesmo prazo da API (VALIDADE): pedido pendente vence em 10 minutos. */
export const VALIDADE_MS = 10 * 60_000
/** De quanto em quanto tempo as telas perguntam de novo pelo pedido. */
export const INTERVALO_DE_ATUALIZACAO_MS = 5_000

const id = encodeURIComponent

const clienteHttp: ClienteCarroca = {
  pedir: (pedido) => requisitar<PedidoDoTurista>('POST', '/ride-requests', pedido),
  pedidoAtual: async () =>
    (await requisitar<PedidoDoTurista | undefined>('GET', '/ride-requests/current')) ?? null,
  cancelar: (pedido) => requisitar<PedidoDoTurista>('POST', `/ride-requests/${id(pedido)}/cancel`),
  contatos: () => requisitar<ContatoCarroceiro[]>('GET', '/carriers'),
  meuPerfil: () => requisitar<PerfilCarroceiro>('GET', '/carrier/me'),
  atualizarPerfil: (mudancas) => requisitar<PerfilCarroceiro>('PATCH', '/carrier/me', mudancas),
  pedidosAbertos: () => requisitar<PedidoParaCarroceiro[]>('GET', '/carrier/requests'),
  aceitar: (pedido) =>
    requisitar<PedidoParaCarroceiro>('POST', `/carrier/requests/${id(pedido)}/accept`),
  recusar: (pedido) => requisitar<void>('POST', `/carrier/requests/${id(pedido)}/decline`),
  viagens: () => requisitar<PedidoParaCarroceiro[]>('GET', '/carrier/rides'),
}

// ---------------------------------------------------------------------------- mock
// Mesmas regras do serviço da API, sobre o "banco" do mock (reiniciado entre os testes).

const INDISPONIVEL =
  'Este pedido não está mais disponível: outro carroceiro aceitou, ele venceu ou foi cancelado.'

function expiraEm(pedido: PedidoDoMock): string {
  return new Date(Date.parse(pedido.created_at) + VALIDADE_MS).toISOString()
}

function expirarVencidos(): void {
  const agora = Date.now()
  for (const pedido of bancoDoMock().pedidos) {
    if (pedido.status === 'pending' && Date.parse(expiraEm(pedido)) < agora) pedido.status = 'expired'
  }
}

function perfilDe(userId: string | null) {
  return bancoDoMock().carroceiros.find((c) => c.user_id === userId)
}

function doTurista(pedido: PedidoDoMock): PedidoDoTurista {
  const carroceiro = pedido.status === 'accepted' ? perfilDe(pedido.carrier_user_id) : undefined
  return {
    id: pedido.id,
    origin: pedido.origin,
    destination: pedido.destination,
    passengers: pedido.passengers,
    notes: pedido.notes,
    status: pedido.status,
    created_at: pedido.created_at,
    expires_at: expiraEm(pedido),
    responded_at: pedido.responded_at,
    carrier: carroceiro
      ? { display_name: carroceiro.display_name, whatsapp: carroceiro.whatsapp }
      : null,
  }
}

function paraCarroceiro(pedido: PedidoDoMock, userId: string): PedidoParaCarroceiro {
  const meu = pedido.status === 'accepted' && pedido.carrier_user_id === userId
  return {
    id: pedido.id,
    origin: pedido.origin,
    destination: pedido.destination,
    passengers: pedido.passengers,
    notes: pedido.notes,
    status: pedido.status,
    created_at: pedido.created_at,
    expires_at: expiraEm(pedido),
    responded_at: pedido.responded_at,
    tourist_name: pedido.tourist_name,
    tourist_whatsapp: meu ? pedido.tourist_whatsapp : null,
  }
}

function sessao() {
  const usuario = usuarioDaSessaoMock()
  if (!usuario) return { erro: falhar(401, 'Não autenticado.') }
  return { usuario }
}

function sessaoDeCarroceiro() {
  const { usuario, erro } = sessao()
  if (erro) return { erro }
  if (usuario.role !== 'carrier') return { erro: falhar(403, 'Você não tem permissão para isso.') }
  const perfil = perfilDe(usuario.id)
  if (!perfil) {
    return {
      erro: falhar(
        404,
        'Esta conta é de carroceiro, mas ainda não tem perfil. Fale com a equipe.',
      ),
    }
  }
  return { usuario, perfil }
}

const regrasDoMock: ClienteCarroca = {
  pedir(entrada) {
    const { usuario, erro } = sessao()
    if (erro) return erro
    expirarVencidos()
    const { pedidos } = bancoDoMock()
    if (pedidos.some((p) => p.tourist_id === usuario.id && p.status === 'pending')) {
      return falhar(
        409,
        'Você já tem um pedido aguardando carroceiro. Cancele esse antes de pedir outro.',
      )
    }
    const pedido: PedidoDoMock = {
      id: crypto.randomUUID(),
      tourist_id: usuario.id,
      tourist_name: usuario.name,
      tourist_whatsapp: entrada.whatsapp,
      carrier_user_id: null,
      origin: entrada.origin.trim(),
      destination: entrada.destination.trim(),
      passengers: entrada.passengers,
      notes: entrada.notes?.trim() || null,
      status: 'pending',
      created_at: new Date().toISOString(),
      responded_at: null,
    }
    pedidos.push(pedido)
    return responder(doTurista(pedido))
  },

  pedidoAtual() {
    const { usuario, erro } = sessao()
    if (erro) return erro
    expirarVencidos()
    const desde = Date.now() - 6 * 60 * 60_000
    const recentes = bancoDoMock().pedidos.filter(
      (p) =>
        p.tourist_id === usuario.id && p.status !== 'cancelled' && Date.parse(p.created_at) >= desde,
    )
    const ultimo = recentes.at(-1)
    return responder(ultimo ? doTurista(ultimo) : null)
  },

  cancelar(pedidoId) {
    const { usuario, erro } = sessao()
    if (erro) return erro
    expirarVencidos()
    const pedido = bancoDoMock().pedidos.find((p) => p.id === pedidoId)
    if (!pedido || pedido.tourist_id !== usuario.id) return falhar(404, 'Pedido não encontrado.')
    if (pedido.status !== 'pending' && pedido.status !== 'accepted') {
      return falhar(409, 'Este pedido já não pode ser cancelado.')
    }
    pedido.status = 'cancelled'
    return responder(doTurista(pedido))
  },

  contatos() {
    const { erro } = sessao()
    if (erro) return erro
    const contatos = bancoDoMock()
      .carroceiros.filter((c) => c.is_approved && c.whatsapp)
      .sort(
        (a, b) =>
          Number(b.is_available) - Number(a.is_available) ||
          a.display_name.localeCompare(b.display_name, 'pt-BR'),
      )
      .map(({ display_name, whatsapp, capacity, is_available }) => ({
        display_name,
        whatsapp,
        capacity,
        is_available,
      }))
    return responder(contatos)
  },

  meuPerfil() {
    const { perfil, erro } = sessaoDeCarroceiro()
    if (erro) return erro
    const { display_name, whatsapp, capacity, is_available, is_approved } = perfil
    return responder({ display_name, whatsapp, capacity, is_available, is_approved })
  },

  atualizarPerfil(mudancas) {
    const { perfil, erro } = sessaoDeCarroceiro()
    if (erro) return erro
    Object.assign(perfil, mudancas)
    if (!perfil.is_approved) perfil.is_available = false // suspenso não fica disponível
    const { display_name, whatsapp, capacity, is_available, is_approved } = perfil
    return responder({ display_name, whatsapp, capacity, is_available, is_approved })
  },

  pedidosAbertos() {
    const { usuario, perfil, erro } = sessaoDeCarroceiro()
    if (erro) return erro
    expirarVencidos()
    if (!perfil.is_available || !perfil.is_approved) return responder([])
    const { pedidos, recusas } = bancoDoMock()
    const abertos = pedidos.filter(
      (p) =>
        p.status === 'pending' &&
        p.passengers <= perfil.capacity &&
        p.tourist_id !== usuario.id &&
        !recusas.has(`${p.id}:${usuario.id}`),
    )
    return responder(abertos.map((p) => paraCarroceiro(p, usuario.id)))
  },

  aceitar(pedidoId) {
    const { usuario, perfil, erro } = sessaoDeCarroceiro()
    if (erro) return erro
    expirarVencidos()
    if (!perfil.is_approved) {
      return falhar(409, 'Seu perfil de carroceiro está suspenso. Fale com a equipe do Algodoal Digital.')
    }
    if (!perfil.is_available) return falhar(409, 'Fique disponível para aceitar pedidos.')
    const pedido = bancoDoMock().pedidos.find((p) => p.id === pedidoId)
    if (!pedido || pedido.tourist_id === usuario.id) return falhar(404, 'Pedido não encontrado.')
    if (pedido.status !== 'pending') return falhar(409, INDISPONIVEL)
    if (pedido.passengers > perfil.capacity) {
      return falhar(409, 'Este pedido tem mais passageiros do que cabem na sua carroça.')
    }
    pedido.status = 'accepted'
    pedido.carrier_user_id = usuario.id
    pedido.responded_at = new Date().toISOString()
    return responder(paraCarroceiro(pedido, usuario.id))
  },

  recusar(pedidoId) {
    const { usuario, erro } = sessaoDeCarroceiro()
    if (erro) return erro
    expirarVencidos()
    const pedido = bancoDoMock().pedidos.find((p) => p.id === pedidoId)
    if (!pedido || pedido.tourist_id === usuario.id) return falhar(404, 'Pedido não encontrado.')
    if (pedido.status !== 'pending') return falhar(409, INDISPONIVEL)
    bancoDoMock().recusas.add(`${pedido.id}:${usuario.id}`)
    return responder(undefined)
  },

  viagens() {
    const { usuario, erro } = sessaoDeCarroceiro()
    if (erro) return erro
    const desde = Date.now() - 7 * 24 * 60 * 60_000
    const minhas = bancoDoMock()
      .pedidos.filter((p) => p.carrier_user_id === usuario.id && Date.parse(p.created_at) >= desde)
      .reverse()
    return responder(minhas.map((p) => paraCarroceiro(p, usuario.id)))
  },
}

/** Como o cliente real, o mock espera o token de acesso voltar antes de responder. */
function comToken<A extends unknown[], R>(fn: (...args: A) => Promise<R>) {
  return (...args: A) => garantirTokenDeAcesso().then(() => fn(...args))
}

const clienteMockCarroca: ClienteCarroca = {
  pedir: comToken(regrasDoMock.pedir),
  pedidoAtual: comToken(regrasDoMock.pedidoAtual),
  cancelar: comToken(regrasDoMock.cancelar),
  contatos: comToken(regrasDoMock.contatos),
  meuPerfil: comToken(regrasDoMock.meuPerfil),
  atualizarPerfil: comToken(regrasDoMock.atualizarPerfil),
  pedidosAbertos: comToken(regrasDoMock.pedidosAbertos),
  aceitar: comToken(regrasDoMock.aceitar),
  recusar: comToken(regrasDoMock.recusar),
  viagens: comToken(regrasDoMock.viagens),
}

/** Ponto único das telas da carroça, como `api` em cliente.ts. */
export const carroca: ClienteCarroca = usandoMock ? clienteMockCarroca : clienteHttp

// ---------------------------------------------------------- contatos para o modo offline

const CHAVE_CONTATOS = 'algodoal:carroceiros'
const CHAVE_WHATSAPP = 'algodoal:meu-whatsapp'

export interface ContatosGuardados {
  contatos: ContatoCarroceiro[]
  /** ISO; para a tela dizer de quando é a lista. */
  salvoEm: string
}

/** Melhor esforço: sem localStorage (janela anônima, bloqueado), a tela só não tem a lista. */
export function guardarContatos(contatos: ContatoCarroceiro[]): void {
  try {
    const valor: ContatosGuardados = { contatos, salvoEm: new Date().toISOString() }
    localStorage.setItem(CHAVE_CONTATOS, JSON.stringify(valor))
  } catch {
    // sem armazenamento local
  }
}

export function contatosGuardados(): ContatosGuardados | null {
  try {
    const bruto = localStorage.getItem(CHAVE_CONTATOS)
    if (!bruto) return null
    const valor = JSON.parse(bruto) as ContatosGuardados
    return Array.isArray(valor?.contatos) ? valor : null
  } catch {
    return null
  }
}

/** O WhatsApp do último pedido, para não digitar de novo. */
export function whatsappGuardado(): string {
  try {
    return localStorage.getItem(CHAVE_WHATSAPP) ?? ''
  } catch {
    return ''
  }
}

export function guardarWhatsapp(numero: string): void {
  try {
    localStorage.setItem(CHAVE_WHATSAPP, numero)
  } catch {
    // sem armazenamento local
  }
}
