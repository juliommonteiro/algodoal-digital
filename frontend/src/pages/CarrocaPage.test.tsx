import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { guardarContatos } from '../lib/carroca'
import { bancoDoMock, type PedidoDoMock } from '../lib/mock'
import { CARROCEIRO, renderizarEm, simularSessao, TURISTA } from '../test/utils'

function preencher() {
  fireEvent.change(screen.getByLabelText('Origem'), { target: { value: 'Vila — orla' } })
  fireEvent.change(screen.getByLabelText('Destino'), { target: { value: 'Praia da Princesa' } })
  fireEvent.change(screen.getByLabelText('Seu WhatsApp com DDD'), {
    target: { value: '(91) 97777-1111' },
  })
}

function pedidoNoMock(mudancas: Partial<PedidoDoMock> = {}): PedidoDoMock {
  const pedido: PedidoDoMock = {
    id: crypto.randomUUID(),
    tourist_id: TURISTA.id,
    tourist_name: TURISTA.name,
    tourist_whatsapp: '(91) 97777-1111',
    carrier_user_id: null,
    origin: 'Vila — orla',
    destination: 'Praia da Princesa',
    passengers: 2,
    notes: null,
    status: 'pending',
    created_at: new Date().toISOString(),
    responded_at: null,
    ...mudancas,
  }
  bancoDoMock().pedidos.push(pedido)
  return pedido
}

describe('pedir carroça', () => {
  it('envia o pedido e mostra que está procurando carroceiros', async () => {
    simularSessao()
    renderizarEm('/carroca')
    await screen.findByLabelText('Origem')

    preencher()
    fireEvent.click(screen.getByRole('button', { name: 'Mais um passageiro' }))
    fireEvent.click(screen.getByRole('button', { name: 'Mais um passageiro' }))
    fireEvent.change(screen.getByLabelText('Horário · observações'), {
      target: { value: 'Agora · duas malas' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Solicitar carroça' }))

    expect(await screen.findByRole('heading', { name: 'Procurando carroceiros' })).toBeInTheDocument()
    expect(screen.getByText(/3 pessoas/)).toBeInTheDocument()
    const [pedido] = bancoDoMock().pedidos
    expect(pedido).toMatchObject({
      origin: 'Vila — orla',
      destination: 'Praia da Princesa',
      passengers: 3,
      notes: 'Agora · duas malas',
      tourist_whatsapp: '(91) 97777-1111',
      status: 'pending',
    })
  })

  it('valida no cliente e não envia nada', async () => {
    simularSessao()
    renderizarEm('/carroca')
    fireEvent.change(await screen.findByLabelText('Seu WhatsApp com DDD'), {
      target: { value: '98888-7777' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Solicitar carroça' }))

    expect(screen.getByText('Informe onde você está.')).toBeInTheDocument()
    expect(screen.getByText('Informe para onde vai.')).toBeInTheDocument()
    expect(screen.getByText(/WhatsApp com DDD, por exemplo/)).toBeInTheDocument()
    expect(screen.getByLabelText('Origem')).toHaveFocus()
    expect(bancoDoMock().pedidos).toHaveLength(0)
  })

  it('passageiros vão de 1 a 12', async () => {
    simularSessao()
    renderizarEm('/carroca')
    const menos = await screen.findByRole('button', { name: 'Menos um passageiro' })

    expect(menos).toBeDisabled()
    expect(screen.getByText('1 pessoa')).toBeInTheDocument()
    const mais = screen.getByRole('button', { name: 'Mais um passageiro' })
    for (let i = 0; i < 15; i++) fireEvent.click(mais)
    expect(screen.getByText('12 pessoas')).toBeInTheDocument()
    expect(mais).toBeDisabled()
  })

  it('lembra o WhatsApp do último pedido', async () => {
    localStorage.setItem('algodoal:meu-whatsapp', '(91) 97777-1111')
    simularSessao()
    renderizarEm('/carroca')

    expect(await screen.findByLabelText('Seu WhatsApp com DDD')).toHaveValue('(91) 97777-1111')
  })

  it('cancelar volta ao formulário', async () => {
    pedidoNoMock()
    simularSessao()
    renderizarEm('/carroca')

    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar solicitação' }))

    expect(await screen.findByLabelText('Origem')).toBeInTheDocument()
    expect(bancoDoMock().pedidos[0].status).toBe('cancelled')
  })

  it('depois do aceite mostra o carroceiro e o WhatsApp dele', async () => {
    const pedido = pedidoNoMock()
    simularSessao()
    renderizarEm('/carroca')
    await screen.findByRole('heading', { name: 'Procurando carroceiros' })

    // O carroceiro aceita em outro aparelho; o turista atualiza.
    Object.assign(pedido, { status: 'accepted', carrier_user_id: CARROCEIRO.id })
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar' }))

    expect(await screen.findByRole('heading', { name: 'Carroça do Bento aceitou' })).toBeInTheDocument()
    const link = screen.getByRole('link', { name: /Chamar Carroça do Bento no WhatsApp/ })
    expect(link.getAttribute('href')).toMatch(/^https:\/\/wa\.me\/5591955550202\?text=/)
  })

  it('pedido vencido oferece pedir de novo e os contatos aprovados', async () => {
    pedidoNoMock({ created_at: new Date(Date.now() - 11 * 60_000).toISOString() })
    simularSessao()
    renderizarEm('/carroca')

    expect(await screen.findByRole('heading', { name: 'Ninguém aceitou a tempo' })).toBeInTheDocument()
    const contatos = await screen.findByRole('region', { name: 'Carroceiros' })
    expect(within(contatos).getByText('Carroça do Bento')).toBeInTheDocument()
    expect(within(contatos).queryByText('Carroça do Tião')).not.toBeInTheDocument() // não aprovado
    expect(within(contatos).getByText(/indisponível agora/)).toBeInTheDocument() // a Rosa

    fireEvent.click(screen.getByRole('button', { name: 'Pedir de novo' }))
    expect(screen.getByLabelText('Origem')).toBeInTheDocument()
  })

  it('sem internet não pede e mostra os carroceiros guardados', async () => {
    guardarContatos([
      { display_name: 'Carroça do Bento', whatsapp: '(91) 95555-0202', capacity: 4, is_available: true },
    ])
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    simularSessao()
    renderizarEm('/carroca')

    expect(
      await screen.findByRole('heading', { name: 'Pedir carroça precisa de internet' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Solicitar carroça' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Chamar Carroça do Bento no WhatsApp' })).toBeInTheDocument()
  })

  it('sem internet e sem lista guardada explica como conseguir a lista', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    simularSessao()
    renderizarEm('/carroca')

    expect(await screen.findByText(/Abra esta tela uma vez com internet/)).toBeInTheDocument()
  })

  it('com internet guarda a lista de contatos para depois', async () => {
    simularSessao()
    renderizarEm('/carroca')
    await screen.findByLabelText('Origem')

    await waitFor(() => expect(localStorage.getItem('algodoal:carroceiros')).toContain('Carroça do Bento'))
  })
})
