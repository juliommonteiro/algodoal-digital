import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ErroApi } from '../lib/api'
import { bancoDoMock, clienteMock } from '../lib/mock'
import { ADMIN, renderizarEm, simularSessao } from '../test/utils'
import { clienteAdminMock } from './cliente'

const localPorNome = (nome: string) => {
  const local = bancoDoMock().locais.find((l) => l.name === nome)
  if (!local) throw new Error(`local do mock inexistente: ${nome}`)
  return local
}
const categoriaPorSlug = (slug: string) => bancoDoMock().categorias.find((c) => c.slug === slug)!

/** Nomes nas linhas da tabela (a primeira célula de cada linha é o cabeçalho da linha). */
const nomesNaTabela = () => screen.queryAllByRole('rowheader').map((celula) => celula.textContent)

async function abrirLista(caminho = '/admin') {
  simularSessao(ADMIN)
  const router = renderizarEm(caminho)
  await screen.findByRole('table')
  return router
}

function linhaDe(nome: string) {
  return screen.getByRole('rowheader', { name: nome }).closest('tr') as HTMLElement
}

describe('acesso ao painel', () => {
  it('sem sessão, /admin manda para o login guardando o destino', () => {
    const router = renderizarEm('/admin')

    expect(screen.getByRole('heading', { name: 'Entrar' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/entrar')
    expect(router.state.location.state).toEqual({ de: '/admin' })
  })

  it('turista em /admin volta ao mapa, sem tela de erro', async () => {
    simularSessao() // turista
    const router = renderizarEm('/admin/locais')

    expect(router.state.location.pathname).toBe('/')
    expect(screen.getByRole('heading', { name: 'Mapa' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Área restrita' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Locais' })).not.toBeInTheDocument()
    // Espera a lista do mapa assentar, para nada atualizar depois do fim do teste.
    await screen.findByRole('heading', { name: 'Praia do Cajueiro Torto' })
  })

  it('admin vê a barra lateral com as seções futuras desabilitadas e a semana', async () => {
    await abrirLista()

    const lateral = screen.getByRole('complementary', { name: 'Seções do painel' })
    expect(within(lateral).getByRole('link', { name: 'Locais' })).toHaveAttribute(
      'href',
      '/admin/locais',
    )
    for (const [secao, semana] of [
      ['Carroceiros', 'S9'],
      ['Missões', 'S10'],
      ['Recompensas', 'S11'],
      ['Usuários', 'a definir'],
    ]) {
      const item = within(lateral).getByText(secao)
      expect(item).toHaveAttribute('aria-disabled', 'true')
      expect(item).toHaveTextContent(semana)
      expect(within(lateral).queryByRole('link', { name: new RegExp(secao) })).toBeNull()
    }
  })
})

describe('lista de locais', () => {
  it('traz rascunhos e removidos, que o público não vê', async () => {
    localPorNome('Mirante da Pedra Lisa').is_published = false
    localPorNome('Praia do Sol Deitado').deleted_at = '2026-09-30T12:00:00Z'

    await abrirLista()

    expect(nomesNaTabela()).toHaveLength(bancoDoMock().locais.length)
    expect(within(linhaDe('Mirante da Pedra Lisa')).getByText('Rascunho')).toBeInTheDocument()
    const removido = linhaDe('Praia do Sol Deitado')
    expect(within(removido).getByText('Removido')).toBeInTheDocument()
    expect(removido).toHaveClass('admin-tabela__removido')
    expect(
      within(removido).getByRole('button', { name: 'Restaurar Praia do Sol Deitado' }),
    ).toBeInTheDocument()

    const publicos = (await clienteMock.locais()).map((l) => l.name)
    expect(publicos).not.toContain('Mirante da Pedra Lisa')
    expect(publicos).not.toContain('Praia do Sol Deitado')
  })

  it('filtra por tipo, status, categoria e busca, guardando os filtros na URL', async () => {
    localPorNome('Praia do Sol Deitado').deleted_at = '2026-09-30T12:00:00Z'
    const router = await abrirLista()

    fireEvent.change(screen.getByLabelText('Tipo'), { target: { value: 'beach' } })
    await waitFor(() =>
      expect(nomesNaTabela()).toEqual([
        'Praia da Maré Virada',
        'Praia do Cajueiro Torto',
        'Praia do Sol Deitado',
      ]),
    )
    expect(router.state.location.search).toBe('?tipo=beach')

    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'removido' } })
    await waitFor(() => expect(nomesNaTabela()).toEqual(['Praia do Sol Deitado']))

    fireEvent.change(screen.getByLabelText('Tipo'), { target: { value: '' } })
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: '' } })
    // Categoria raiz traz as subcategorias (Hospedagem → Pousadas).
    fireEvent.change(screen.getByLabelText('Categoria'), { target: { value: 'hospedagem' } })
    await waitFor(() =>
      expect(nomesNaTabela()).toEqual(['Pousada Maré Mansa', 'Pousada Rede de Areia']),
    )

    fireEvent.change(screen.getByLabelText('Categoria'), { target: { value: '' } })
    // Busca sem acento e sem diferenciar maiúsculas.
    fireEvent.change(screen.getByLabelText('Buscar pelo nome'), { target: { value: 'CARIMBO' } })
    await waitFor(() => expect(nomesNaTabela()).toEqual(['Roda de Carimbó do Terreiro Velho']))
    expect(router.state.location.search).toBe('?q=CARIMBO')

    fireEvent.change(screen.getByLabelText('Buscar pelo nome'), { target: { value: 'xyz' } })
    expect(
      await screen.findByRole('heading', { name: 'Nenhum local encontrado' }),
    ).toBeInTheDocument()
  })

  it('remove depois de confirmar (o local some do público e fica na lista) e restaura', async () => {
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const alvo = localPorNome('Praia do Sol Deitado')
    await abrirLista()

    fireEvent.click(screen.getByRole('button', { name: 'Remover Praia do Sol Deitado' }))

    expect(confirmar).toHaveBeenCalledWith(
      expect.stringContaining('Remover "Praia do Sol Deitado"?'),
    )
    expect(
      await screen.findByText('"Praia do Sol Deitado" foi removido do mapa público.'),
    ).toBeInTheDocument()
    const linha = linhaDe('Praia do Sol Deitado')
    expect(within(linha).getByText('Removido')).toBeInTheDocument()
    await expect(clienteMock.local(alvo.id)).rejects.toMatchObject({ status: 404 })

    fireEvent.click(within(linha).getByRole('button', { name: 'Restaurar Praia do Sol Deitado' }))

    expect(
      await screen.findByText('"Praia do Sol Deitado" foi restaurado e voltou ao mapa.'),
    ).toBeInTheDocument()
    expect(within(linhaDe('Praia do Sol Deitado')).getByText('Publicado')).toBeInTheDocument()
    await expect(clienteMock.local(alvo.id)).resolves.toMatchObject({
      name: 'Praia do Sol Deitado',
    })
  })

  it('sem confirmação não remove', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const remover = vi.spyOn(clienteAdminMock, 'remover')
    await abrirLista()

    fireEvent.click(screen.getByRole('button', { name: 'Remover Praia do Sol Deitado' }))

    expect(remover).not.toHaveBeenCalled()
    expect(within(linhaDe('Praia do Sol Deitado')).getByText('Publicado')).toBeInTheDocument()
  })

  it('mostra o erro quando a remoção falha', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.spyOn(clienteAdminMock, 'remover').mockRejectedValue(
      new ErroApi(0, 'Sem conexão com o servidor. Verifique a internet e tente de novo.'),
    )
    await abrirLista()

    fireEvent.click(screen.getByRole('button', { name: 'Remover Praia do Sol Deitado' }))

    expect(
      await screen.findByText(
        'Não foi possível remover "Praia do Sol Deitado": Sem conexão com o servidor. Verifique a internet e tente de novo.',
      ),
    ).toBeInTheDocument()
  })
})

describe('formulário do local', () => {
  async function abrirNovo() {
    simularSessao(ADMIN)
    const router = renderizarEm('/admin/locais/novo')
    await screen.findByRole('heading', { name: 'Novo local' })
    return router
  }

  function preencherValido() {
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Quiosque do Teste' } })
    fireEvent.change(screen.getByLabelText('Tipo'), { target: { value: 'business' } })
    fireEvent.change(screen.getByLabelText('Categoria'), {
      target: { value: categoriaPorSlug('barracas').id },
    })
    fireEvent.change(screen.getByLabelText('Latitude'), { target: { value: '-0,5901' } })
    fireEvent.change(screen.getByLabelText('Longitude'), { target: { value: '-47,5802' } })
  }

  it('enviado vazio, marca os obrigatórios e leva o foco ao nome, sem chamar a API', async () => {
    const criar = vi.spyOn(clienteAdminMock, 'criar')
    await abrirNovo()

    fireEvent.click(screen.getByRole('button', { name: 'Criar local' }))

    const nome = screen.getByLabelText('Nome')
    expect(nome).toHaveAttribute('aria-invalid', 'true')
    expect(nome).toHaveAccessibleDescription('Informe o nome do local.')
    expect(nome).toHaveFocus()
    expect(screen.getByLabelText('Tipo')).toHaveAccessibleDescription('Escolha o tipo.')
    expect(screen.getByLabelText('Categoria')).toHaveAccessibleDescription('Escolha a categoria.')
    expect(screen.getByLabelText('Latitude')).toHaveAccessibleDescription('Informe a latitude.')
    expect(screen.getByText('Confira os campos marcados.')).toBeInTheDocument()
    expect(criar).not.toHaveBeenCalled()

    // Corrigir o campo tira o erro dele.
    fireEvent.change(nome, { target: { value: 'Quiosque' } })
    expect(nome).not.toHaveAttribute('aria-invalid')
  })

  it('recusa no cliente a coordenada fora da área do mapa', async () => {
    await abrirNovo()
    preencherValido()
    fireEvent.change(screen.getByLabelText('Latitude'), { target: { value: '-1,2' } })

    fireEvent.click(screen.getByRole('button', { name: 'Criar local' }))

    expect(screen.getByLabelText('Latitude')).toHaveAccessibleDescription(
      'Fora da área do mapa: a latitude precisa ficar entre -0,66 e -0,56. Com esta coordenada o local não apareceria no mapa.',
    )
    expect(screen.getByLabelText('Latitude')).toHaveFocus()
  })

  it('marca nos campos os erros que a API devolveu', async () => {
    vi.spyOn(clienteAdminMock, 'criar').mockRejectedValue(
      new ErroApi(422, 'Fora da área do mapa…', {
        longitude: 'Fora da área do mapa: veio da API.',
        'business.whatsapp': 'String should have at most 30 characters',
        'business.opening_hours': 'Em seg, o horário de abrir precisa vir antes do de fechar.',
      }),
    )
    await abrirNovo()
    preencherValido()
    fireEvent.click(screen.getByLabelText(/Este local é um estabelecimento/))
    fireEvent.change(screen.getByLabelText('WhatsApp'), { target: { value: '(91) 95555-0000' } })

    fireEvent.click(screen.getByRole('button', { name: 'Criar local' }))

    expect(
      await screen.findByText('A API recusou: confira os campos marcados.'),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Longitude')).toHaveAccessibleDescription(
      'Fora da área do mapa: veio da API.',
    )
    expect(screen.getByLabelText('Longitude')).toHaveFocus()
    expect(screen.getByLabelText('WhatsApp')).toHaveAccessibleDescription(
      'String should have at most 30 characters',
    )
    expect(
      screen.getByText('Em seg, o horário de abrir precisa vir antes do de fechar.'),
    ).toBeInTheDocument()
  })

  it('cria o local, volta à lista com a mensagem e ele aparece no mapa público', async () => {
    const router = await abrirNovo()
    preencherValido()
    fireEvent.click(screen.getByLabelText(/Este local é um estabelecimento/))
    fireEvent.change(screen.getByLabelText('WhatsApp'), { target: { value: '(91) 95555-0199' } })
    fireEvent.change(screen.getByLabelText('Serviços'), { target: { value: 'Pix, sombra' } })
    fireEvent.change(screen.getByLabelText('Sábado'), {
      target: { value: '09:00-12:00, 14:00-18:00' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Criar local' }))

    expect(await screen.findByText('"Quiosque do Teste" foi criado.')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/admin/locais')
    expect(await screen.findByRole('rowheader', { name: 'Quiosque do Teste' })).toBeInTheDocument()
    const publico = (await clienteMock.locais()).find((l) => l.name === 'Quiosque do Teste')
    expect(publico).toMatchObject({
      latitude: -0.5901,
      longitude: -47.5802,
      business: {
        whatsapp: '(91) 95555-0199',
        services: ['Pix', 'sombra'],
        opening_hours: {
          sab: [
            ['09:00', '12:00'],
            ['14:00', '18:00'],
          ],
        },
      },
    })
  })

  it('na edição, envia só o que mudou', async () => {
    const alvo = localPorNome('Pousada Maré Mansa')
    const atualizar = vi.spyOn(clienteAdminMock, 'atualizar')
    simularSessao(ADMIN)
    renderizarEm(`/admin/locais/${alvo.id}`)
    const nome = await screen.findByLabelText('Nome')
    expect(nome).toHaveValue('Pousada Maré Mansa')
    expect(screen.getByLabelText('Latitude')).toHaveValue(String(alvo.latitude).replace('.', ','))
    expect(screen.getByLabelText('Segunda')).toHaveValue('07:00-21:00')

    fireEvent.change(nome, { target: { value: 'Pousada Maré Mansa II' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }))

    expect(await screen.findByText('"Pousada Maré Mansa II" foi salvo.')).toBeInTheDocument()
    expect(atualizar).toHaveBeenCalledWith(alvo.id, { name: 'Pousada Maré Mansa II' })
  })

  it('local inexistente mostra "Local não encontrado"', async () => {
    simularSessao(ADMIN)
    renderizarEm('/admin/locais/00000000-0000-4000-b000-999999999999')

    expect(await screen.findByRole('heading', { name: 'Local não encontrado' })).toBeInTheDocument()
  })
})
