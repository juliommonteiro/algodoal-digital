import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { bancoDoMock, type PedidoDoMock } from '../lib/mock'
import { CARROCEIRO, renderizarEm, simularSessao, TURISTA } from '../test/utils'

function pedidoNoMock(mudancas: Partial<PedidoDoMock> = {}): PedidoDoMock {
  const pedido: PedidoDoMock = {
    id: crypto.randomUUID(),
    tourist_id: TURISTA.id,
    tourist_name: TURISTA.name,
    tourist_whatsapp: '(91) 97777-1111',
    carrier_user_id: null,
    origin: 'Vila de Algodoal',
    destination: 'Praia da Princesa',
    passengers: 3,
    notes: 'Agora · duas malas',
    status: 'pending',
    created_at: new Date().toISOString(),
    responded_at: null,
    ...mudancas,
  }
  bancoDoMock().pedidos.push(pedido)
  return pedido
}

describe('painel do carroceiro', () => {
  it('mostra o perfil e o pedido novo, sem o WhatsApp do turista', async () => {
    pedidoNoMock()
    simularSessao(CARROCEIRO)
    renderizarEm('/carroceiro')

    expect(await screen.findByText('Carroça do Bento')).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Disponível para viagens' })).toBeChecked()
    const pedido = screen.getByRole('article', { name: /Pedido de Ana Viajante/ })
    expect(within(pedido).getByText('Praia da Princesa')).toBeInTheDocument()
    expect(within(pedido).getByText('Agora · duas malas')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Chamar Ana Viajante/ })).not.toBeInTheDocument()
  })

  it('aceitar leva o pedido para a semana, com o WhatsApp do turista', async () => {
    pedidoNoMock()
    simularSessao(CARROCEIRO)
    renderizarEm('/carroceiro')

    fireEvent.click(await screen.findByRole('button', { name: 'Aceitar' }))

    const link = await screen.findByRole('link', { name: 'Chamar Ana Viajante no WhatsApp' })
    expect(link.getAttribute('href')).toMatch(/^https:\/\/wa\.me\/5591977771111\?text=/)
    expect(screen.queryByRole('article')).not.toBeInTheDocument()
    expect(bancoDoMock().pedidos[0]).toMatchObject({
      status: 'accepted',
      carrier_user_id: CARROCEIRO.id,
    })
  })

  it('recusar tira o pedido só da lista dele', async () => {
    const pedido = pedidoNoMock()
    simularSessao(CARROCEIRO)
    renderizarEm('/carroceiro')

    fireEvent.click(await screen.findByRole('button', { name: 'Recusar' }))

    await waitFor(() => expect(screen.queryByRole('article')).not.toBeInTheDocument())
    expect(pedido.status).toBe('pending')
    expect(bancoDoMock().recusas.has(`${pedido.id}:${CARROCEIRO.id}`)).toBe(true)
  })

  it('se outro carroceiro aceitou antes, avisa e tira o pedido da tela', async () => {
    const pedido = pedidoNoMock()
    simularSessao(CARROCEIRO)
    renderizarEm('/carroceiro')
    const aceitar = await screen.findByRole('button', { name: 'Aceitar' })

    Object.assign(pedido, { status: 'accepted', carrier_user_id: 'outro' })
    fireEvent.click(aceitar)

    expect(await screen.findByRole('alert')).toHaveTextContent(/outro carroceiro aceitou/)
    await waitFor(() => expect(screen.queryByRole('article')).not.toBeInTheDocument())
  })

  it('pedido maior que a carroça não aparece', async () => {
    pedidoNoMock({ passengers: 6 }) // Bento leva 4
    simularSessao(CARROCEIRO)
    renderizarEm('/carroceiro')

    expect(await screen.findByText(/Nenhum pedido agora/)).toBeInTheDocument()
  })

  it('desligar a disponibilidade para de mostrar pedidos', async () => {
    pedidoNoMock()
    simularSessao(CARROCEIRO)
    renderizarEm('/carroceiro')
    const chave = await screen.findByRole('switch', { name: 'Disponível para viagens' })

    fireEvent.click(chave)

    await waitFor(() => expect(chave).not.toBeChecked())
    expect(screen.getByText('Indisponível: você não recebe pedidos')).toBeInTheDocument()
    expect(screen.queryByRole('article')).not.toBeInTheDocument()
  })

  it('turista não entra no painel', async () => {
    simularSessao()
    renderizarEm('/carroceiro')

    expect(await screen.findByRole('heading', { name: 'Área restrita' })).toBeInTheDocument()
  })
})
