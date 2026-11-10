import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ErroApi } from './lib/api'
import { clienteMock } from './lib/mock'
import { renderizarEm, simularSessao } from './test/utils'

describe('rotas públicas', () => {
  it('abre o Mapa em / com a navegação principal e a lista de locais', async () => {
    renderizarEm('/')

    expect(screen.getByRole('heading', { name: 'Mapa' })).toBeInTheDocument()
    const nav = screen.getByRole('navigation', { name: 'Navegação principal' })
    for (const aba of ['Mapa', 'Diretório', 'Carroça', 'Passaporte']) {
      expect(within(nav).getByRole('link', { name: aba })).toBeInTheDocument()
    }
    // Lista vem do cliente de dados (mock)
    expect(await screen.findByRole('heading', { name: 'Praia do Cajueiro Torto' })).toBeInTheDocument()
  })

  it('/entrar e /criar-conta ficam fora do layout de abas', () => {
    renderizarEm('/entrar')
    expect(screen.getByRole('heading', { name: 'Entrar' })).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Navegação principal' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Continuar sem conta' })).toHaveAttribute('href', '/')
  })

  it('rota desconhecida mostra "Página não encontrada"', () => {
    renderizarEm('/nao-existe')
    expect(screen.getByRole('heading', { name: 'Página não encontrada' })).toBeInTheDocument()
  })
})

describe('rotas protegidas', () => {
  it('/passaporte sem sessão redireciona para /entrar guardando a rota pretendida', async () => {
    const router = renderizarEm('/passaporte')

    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/entrar')
    expect(router.state.location.state).toEqual({ de: '/passaporte' })
  })

  it('/passaporte com sessão simulada renderiza o Passaporte', () => {
    simularSessao()
    renderizarEm('/passaporte')

    expect(screen.getByRole('heading', { name: 'Passaporte' })).toBeInTheDocument()
  })

  it('depois de entrar, volta para a rota que a pessoa queria', async () => {
    const router = renderizarEm('/passaporte')
    await screen.findByRole('heading', { name: 'Entrar' })

    fireEvent.change(screen.getByLabelText('E-mail'), {
      target: { value: 'ana.turista@example.com' },
    })
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'senha-de-teste' } })
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByRole('heading', { name: 'Passaporte' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/passaporte')
  })

  it('perfil sem permissão vê "Área restrita" em vez do painel', () => {
    simularSessao() // turista
    renderizarEm('/carroceiro')

    expect(screen.getByRole('heading', { name: 'Área restrita' })).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'Painel do carroceiro' }),
    ).not.toBeInTheDocument()
  })
})

describe('formulário de acesso', () => {
  it('mostra erro de campo obrigatório ao enviar vazio, ligado ao input', () => {
    renderizarEm('/entrar')

    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))

    const email = screen.getByLabelText('E-mail')
    const senha = screen.getByLabelText('Senha')
    expect(screen.getByText('Informe seu e-mail.')).toBeInTheDocument()
    expect(screen.getByText('Informe sua senha.')).toBeInTheDocument()
    expect(email).toHaveAttribute('aria-invalid', 'true')
    expect(email).toHaveAccessibleDescription('Informe seu e-mail.')
    expect(senha).toHaveAccessibleDescription('Informe sua senha.')
    expect(email).toHaveFocus()
  })

  it('mostra a mensagem da API quando a senha não confere', async () => {
    renderizarEm('/entrar')

    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'ninguem@example.com' } })
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'qualquer-coisa' } })
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('E-mail ou senha incorretos.')
  })
})

describe('cadastro', () => {
  it('valida cada campo no cliente', () => {
    renderizarEm('/criar-conta')

    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'sem-arroba' } })
    fireEvent.change(screen.getByLabelText(/^Senha/), { target: { value: 'curta' } })
    fireEvent.change(screen.getByLabelText('Repita a senha'), { target: { value: 'outra' } })
    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }))

    expect(screen.getByText('Informe seu nome.')).toBeInTheDocument()
    expect(screen.getByText(/não parece válido/)).toBeInTheDocument()
    expect(screen.getByText('A senha precisa ter pelo menos 8 caracteres.')).toBeInTheDocument()
    expect(screen.getByText('As senhas não são iguais.')).toBeInTheDocument()
  })

  function preencherConta(email: string) {
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Bento da Carroça' } })
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: email } })
    fireEvent.change(screen.getByLabelText(/^Senha/), { target: { value: 'senha-segura' } })
    fireEvent.change(screen.getByLabelText('Repita a senha'), { target: { value: 'senha-segura' } })
  }

  it('campos de carroceiro só aparecem com a opção marcada', () => {
    renderizarEm('/criar-conta')

    expect(screen.queryByLabelText('WhatsApp com DDD')).not.toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Sou carroceiro e quero receber pedidos'))

    expect(screen.getByLabelText('WhatsApp com DDD')).toBeInTheDocument()
    expect(screen.getByLabelText('Quantas pessoas cabem na carroça')).toHaveValue(2)
  })

  it('carroceiro sem WhatsApp válido não é enviado e o foco vai para o campo', () => {
    const registrar = vi.spyOn(clienteMock, 'registrar')
    renderizarEm('/criar-conta')
    preencherConta('bento@example.com')
    fireEvent.click(screen.getByLabelText('Sou carroceiro e quero receber pedidos'))
    fireEvent.change(screen.getByLabelText('WhatsApp com DDD'), { target: { value: '98888-7777' } })
    fireEvent.change(screen.getByLabelText('Quantas pessoas cabem na carroça'), {
      target: { value: '0' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }))

    expect(screen.getByText(/WhatsApp com DDD, por exemplo/)).toBeInTheDocument()
    expect(screen.getByText('Informe quantas pessoas cabem, de 1 a 12.')).toBeInTheDocument()
    expect(screen.getByLabelText('WhatsApp com DDD')).toHaveFocus()
    expect(registrar).not.toHaveBeenCalled()
  })

  it('carroceiro cria a conta com o perfil e cai na área do carroceiro', async () => {
    const registrar = vi.spyOn(clienteMock, 'registrar')
    const router = renderizarEm('/criar-conta')
    preencherConta('bento.novo@example.com')
    fireEvent.click(screen.getByLabelText('Sou carroceiro e quero receber pedidos'))
    fireEvent.change(screen.getByLabelText('WhatsApp com DDD'), {
      target: { value: '(91) 98888-7777' },
    })
    fireEvent.change(screen.getByLabelText('Quantas pessoas cabem na carroça'), {
      target: { value: '5' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }))

    expect(await screen.findByRole('heading', { name: 'Painel do carroceiro' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/carroceiro')
    // O painel já abre com o perfil criado no cadastro, disponível e com a capacidade informada.
    expect(await screen.findByText('Disponível para viagens · até 5 pessoas')).toBeInTheDocument()
    expect(registrar).toHaveBeenCalledWith(
      'Bento da Carroça',
      'bento.novo@example.com',
      'senha-segura',
      { whatsapp: '(91) 98888-7777', capacity: 5 },
    )
  })

  it('turista continua indo para o mapa, sem perfil de carroceiro', async () => {
    const registrar = vi.spyOn(clienteMock, 'registrar')
    const router = renderizarEm('/criar-conta')
    preencherConta('ana.nova@example.com')
    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
    expect(registrar).toHaveBeenCalledWith(
      'Bento da Carroça',
      'ana.nova@example.com',
      'senha-segura',
      undefined,
    )
  })

  it('erro da API no WhatsApp aparece no campo, não como erro geral', async () => {
    vi.spyOn(clienteMock, 'registrar').mockRejectedValueOnce(
      new ErroApi(422, 'Informe o WhatsApp com DDD, por exemplo (91) 98888-7777.', {
        'carrier.whatsapp': 'Informe o WhatsApp com DDD, por exemplo (91) 98888-7777.',
      }),
    )
    renderizarEm('/criar-conta')
    preencherConta('bento.api@example.com')
    fireEvent.click(screen.getByLabelText('Sou carroceiro e quero receber pedidos'))
    fireEvent.change(screen.getByLabelText('WhatsApp com DDD'), {
      target: { value: '(91) 98888-7777' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }))

    await waitFor(() => expect(screen.getByLabelText('WhatsApp com DDD')).toHaveFocus())
    expect(screen.getByLabelText('WhatsApp com DDD')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('diretório', () => {
  it('lista todos os locais publicados, não só estabelecimentos', async () => {
    renderizarEm('/diretorio')

    // Praia, trilha e ponto de coleta aparecem junto com os negócios (protótipo 04-diretorio)
    expect(await screen.findByRole('heading', { name: 'Praia do Cajueiro Torto' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Trilha do Vento Sul' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Ponto de Coleta Boca da Mata' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Restaurante Vento Sul' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Pousada Maré Mansa' })).toBeInTheDocument()
    // Mesmo conteúdo do Mapa: os 16 locais publicados do mock
    expect(screen.getByRole('heading', { name: '16 locais' })).toBeInTheDocument()
    // Chips cobrem as categorias sem negócio também
    const grupo = screen.getByRole('radiogroup', { name: 'Filtrar por categoria' })
    for (const nome of ['Turismo', 'Alimentação', 'Hospedagem', 'Serviços', 'Cultura', 'Preservação']) {
      expect(within(grupo).getByRole('radio', { name: nome })).toBeInTheDocument()
    }
  })

  it('filtra a lista ao escolher uma categoria', async () => {
    renderizarEm('/diretorio')
    await screen.findByRole('heading', { name: 'Praia do Cajueiro Torto' })
    const grupo = screen.getByRole('radiogroup', { name: 'Filtrar por categoria' })

    // Turismo: praias e trilhas (e pontos turísticos), sem os negócios
    const turismo = within(grupo).getByRole('radio', { name: 'Turismo' })
    fireEvent.click(turismo)
    expect(turismo).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('heading', { name: 'Praia do Cajueiro Torto' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Trilha das Dunas Claras' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Restaurante Vento Sul' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Ponto de Coleta Boca da Mata' })).not.toBeInTheDocument()

    // Hospedagem: só as pousadas
    const hospedagem = within(grupo).getByRole('radio', { name: 'Hospedagem' })
    fireEvent.click(hospedagem)
    expect(hospedagem).toHaveAttribute('aria-checked', 'true')
    expect(turismo).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByRole('heading', { name: 'Pousada Maré Mansa' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Pousada Rede de Areia' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Praia do Cajueiro Torto' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Restaurante Vento Sul' })).not.toBeInTheDocument()
  })

  it('busca pelo nome sem diferenciar acento', async () => {
    renderizarEm('/diretorio')
    await screen.findByRole('heading', { name: 'Restaurante Vento Sul' })

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'mare' } })

    expect(screen.getByRole('heading', { name: 'Pousada Maré Mansa' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Ateliê Linha da Maré' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Praia da Maré Virada' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Restaurante Vento Sul' })).not.toBeInTheDocument()
  })
})

describe('detalhe do local', () => {
  it('/local/:id mostra o nome e os dados comerciais vindos do mock', async () => {
    const locais = await clienteMock.locais()
    const restaurante = locais.find((l) => l.name === 'Restaurante Vento Sul')!
    renderizarEm(`/local/${restaurante.id}`)

    expect(await screen.findByRole('heading', { name: 'Restaurante Vento Sul', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Parceiro Algodoal Digital')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Chamar no WhatsApp' })).toHaveAttribute(
      'href',
      expect.stringMatching(/^https:\/\/wa\.me\/5591955550103\?text=/),
    )
    expect(screen.getByRole('button', { name: 'Ver no mapa' })).toBeDisabled()
  })

  it('id inexistente mostra "Local não encontrado"', async () => {
    renderizarEm('/local/nao-existe')
    expect(await screen.findByRole('heading', { name: 'Local não encontrado' })).toBeInTheDocument()
  })
})

describe('sessão no layout', () => {
  it('mostra "Entrar" sem sessão e o nome com "Sair" com sessão', async () => {
    simularSessao()
    renderizarEm('/')

    expect(screen.getByText('Ana')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Sair' }))

    await waitFor(() => expect(screen.getByRole('link', { name: 'Entrar' })).toBeInTheDocument())
  })
})
