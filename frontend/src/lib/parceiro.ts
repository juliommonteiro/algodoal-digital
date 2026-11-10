/**
 * Cliente do painel do parceiro (#26): o dono, ligado pelo admin (e-mail do dono), edita o
 * próprio estabelecimento. Nome, categoria e posição no mapa continuam com o admin.
 */
import { garantirTokenDeAcesso, requisitar } from './api'
import { usandoMock } from './cliente'
import { bancoDoMock, falhar, publico, responder, usuarioDaSessaoMock } from './mock'
import type { ClienteParceiro, Local } from './tipos'

const id = encodeURIComponent

const clienteHttp: ClienteParceiro = {
  meus: () => requisitar<Local[]>('GET', '/partner/places'),
  atualizar: (localId, mudancas) =>
    requisitar<Local>('PATCH', `/partner/places/${id(localId)}`, mudancas),
}

// Mesmas regras da API (services/parceiro.py), sobre o "banco" do mock.
function meusNoMock() {
  const usuario = usuarioDaSessaoMock()
  if (!usuario) return { erro: falhar(401, 'Não autenticado.') }
  if (usuario.role !== 'partner') return { erro: falhar(403, 'Você não tem permissão para isso.') }
  const locais = bancoDoMock().locais.filter(
    (l) => l.deleted_at === null && l.business?.owner_email === usuario.email,
  )
  return { locais }
}

const clienteMock: ClienteParceiro = {
  async meus() {
    await garantirTokenDeAcesso()
    const { locais, erro } = meusNoMock()
    if (erro) return erro
    return responder(
      locais.map(publico).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    )
  },

  async atualizar(localId, mudancas) {
    await garantirTokenDeAcesso()
    const { locais, erro } = meusNoMock()
    if (erro) return erro
    const local = locais.find((l) => l.id === localId)
    if (!local?.business) return falhar(404, 'Estabelecimento não encontrado.')
    const { description, is_published, ...negocio } = mudancas
    if (description !== undefined) local.description = description?.trim() || null
    if (is_published !== undefined) local.is_published = is_published
    Object.assign(local.business, negocio)
    local.updated_at = new Date().toISOString()
    return responder(publico(local))
  },
}

export const parceiro: ClienteParceiro = usandoMock ? clienteMock : clienteHttp
