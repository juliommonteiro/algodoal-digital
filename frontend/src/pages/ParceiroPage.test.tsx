import { fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { bancoDoMock, clienteMock } from '../lib/mock'
import { parceiro } from '../lib/parceiro'
import { PARCEIRA, renderizarEm, simularSessao } from '../test/utils'

const pousada = () => bancoDoMock().locais.find((l) => l.name === 'Pousada Maré Mansa')!

describe('painel do parceiro', () => {
  it('mostra o estabelecimento da conta, com o que a equipe mantém só para leitura', async () => {
    simularSessao(PARCEIRA)
    renderizarEm('/parceiro')

    expect(await screen.findByRole('heading', { name: 'Pousada Maré Mansa', level: 1 })).toBeInTheDocument()
    expect(screen.getByLabelText('Descrição')).toHaveValue('Dez quartos com rede na varanda.')
    expect(screen.getByLabelText('Segunda')).toHaveValue('07:00-21:00')
    expect(screen.getByText('Pousadas')).toBeInTheDocument() // categoria, só leitura
    expect(screen.queryByLabelText('Nome')).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/Latitude/)).not.toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Aparece no mapa e no diretório' })).toBeChecked()
  })

  it('salva só o que mudou e o turista já vê', async () => {
    const atualizar = vi.spyOn(parceiro, 'atualizar')
    simularSessao(PARCEIRA)
    renderizarEm('/parceiro')
    const descricao = await screen.findByLabelText('Descrição')

    fireEvent.change(descricao, { target: { value: 'Pousada de frente para o campo.' } })
    fireEvent.change(screen.getByLabelText('Serviços'), { target: { value: 'Wi-Fi, Pix' } })
    fireEvent.change(screen.getByLabelText('Domingo'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }))

    expect(await screen.findByText(/Alterações salvas/)).toBeInTheDocument()
    const [, corpo] = atualizar.mock.calls[0]
    expect(Object.keys(corpo).sort()).toEqual(['description', 'opening_hours', 'services'])
    expect(corpo.services).toEqual(['Wi-Fi', 'Pix'])
    expect(corpo.opening_hours).not.toHaveProperty('dom')
    const publico = await clienteMock.local(pousada().id)
    expect(publico.description).toBe('Pousada de frente para o campo.')
    expect(publico.business).not.toHaveProperty('owner_email') // o dono não vaza para o público
  })

  it('horário em formato errado não é enviado e o foco vai para o dia', async () => {
    const atualizar = vi.spyOn(parceiro, 'atualizar')
    simularSessao(PARCEIRA)
    renderizarEm('/parceiro')
    const terca = await screen.findByLabelText('Terça')

    fireEvent.change(terca, { target: { value: '9h às 18h' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }))

    expect(screen.getByText(/Terça: use HH:MM-HH:MM/)).toBeInTheDocument()
    expect(terca).toHaveFocus()
    expect(atualizar).not.toHaveBeenCalled()
  })

  it('tirar do mapa esconde do público e pode voltar', async () => {
    simularSessao(PARCEIRA)
    renderizarEm('/parceiro')
    const chave = await screen.findByRole('switch', { name: 'Aparece no mapa e no diretório' })

    fireEvent.click(chave)

    await waitFor(() => expect(chave).not.toBeChecked())
    expect(screen.getByText('Fora do mapa')).toBeInTheDocument()
    expect((await clienteMock.locais()).map((l) => l.name)).not.toContain('Pousada Maré Mansa')
    fireEvent.click(chave)
    await waitFor(() => expect(chave).toBeChecked())
  })

  it('envia foto, troca a capa e apaga', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    simularSessao(PARCEIRA)
    renderizarEm('/parceiro')
    const entrada = (await screen.findByText('Adicionar foto')).closest('section')!.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement
    const jpeg = () => new File(['jpeg'], 'foto.jpg', { type: 'image/jpeg' })

    fireEvent.change(entrada, { target: { files: [jpeg()] } })
    expect(await screen.findByText('Fotos (1 de 6)')).toBeInTheDocument()
    fireEvent.change(entrada, { target: { files: [jpeg()] } })
    expect(await screen.findByText('Fotos (2 de 6)')).toBeInTheDocument()
    const [primeira, segunda] = pousada().photos.map((f) => f.id)

    fireEvent.click(screen.getByRole('button', { name: 'Usar a foto 2 como capa' }))
    await screen.findByText('Capa trocada.')
    expect(pousada().photos.map((f) => f.id)).toEqual([segunda, primeira])

    fireEvent.click(screen.getByRole('button', { name: 'Apagar a foto 1' }))
    expect(await screen.findByText('Fotos (1 de 6)')).toBeInTheDocument()
    expect(pousada().photos.map((f) => f.id)).toEqual([primeira])
    // O público vê as fotos do local (sem arquivo no mock: o substituto aparece).
    expect((await clienteMock.local(pousada().id)).photos).toHaveLength(1)
  })

  it('formato não aceito mostra o erro e não envia', async () => {
    simularSessao(PARCEIRA)
    renderizarEm('/parceiro')
    const entrada = (await screen.findByText('Adicionar foto')).closest('section')!.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement

    fireEvent.change(entrada, { target: { files: [new File(['gif'], 'a.gif', { type: 'image/gif' })] } })

    expect(await screen.findByRole('alert')).toHaveTextContent('Use uma foto em JPG, PNG ou WebP.')
    expect(pousada().photos).toHaveLength(0)
  })

  it('no limite de 6 fotos o botão trava', async () => {
    pousada().photos = Array.from({ length: 6 }, (_, position) => ({
      id: `foto-${position}`,
      storage_key: `mock/${position}.jpg`,
      position,
    }))
    simularSessao(PARCEIRA)
    renderizarEm('/parceiro')

    expect(await screen.findByRole('button', { name: 'Limite de 6 fotos' })).toBeDisabled()
  })

  it('conta de parceiro sem estabelecimento explica o que fazer', async () => {
    simularSessao({
      id: '00000000-0000-4000-c000-000000000010',
      name: 'Parceiro de Teste',
      email: 'parceiro@example.com',
      role: 'partner',
    })
    renderizarEm('/parceiro')

    expect(await screen.findByText(/Nenhum estabelecimento está ligado à sua conta/)).toBeInTheDocument()
  })

  it('turista não entra no painel do parceiro', async () => {
    simularSessao()
    renderizarEm('/parceiro')

    expect(await screen.findByRole('heading', { name: 'Área restrita' })).toBeInTheDocument()
  })
})
