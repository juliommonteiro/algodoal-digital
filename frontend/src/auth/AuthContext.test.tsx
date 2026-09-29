import { act, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ErroApi, obterTokenAcesso, SEM_REDE } from '../lib/api'
import { clienteMock } from '../lib/mock'
import { TURISTA, simularSessao } from '../test/utils'
import { AuthProvider } from './AuthContext'
import { useAuth } from './contexto'
import { destinoAposLogin } from './destino'
import { CHAVE_SESSAO, lerSessao } from './sessao'

function Sonda() {
  const { usuario } = useAuth()
  return <p>{usuario ? `sessão: ${usuario.name}` : 'sem sessão'}</p>
}

function montar() {
  return render(
    <AuthProvider>
      <Sonda />
    </AuthProvider>,
  )
}

describe('AuthContext', () => {
  it('restaura a sessão do localStorage ao iniciar, sem esperar a rede', () => {
    simularSessao()
    // Renovação que nunca responde: se o provider esperasse a rede, a sessão não apareceria.
    const renovar = vi.spyOn(clienteMock, 'renovar').mockReturnValue(new Promise(() => {}))

    montar()

    // getBy (síncrono), não findBy: a sessão está lá já no primeiro render.
    expect(screen.getByText('sessão: Ana Viajante')).toBeInTheDocument()
    expect(renovar).toHaveBeenCalledTimes(1)
  })

  it('renova o token de acesso em segundo plano e o guarda só em memória', async () => {
    simularSessao()
    montar()

    await waitFor(() => expect(obterTokenAcesso()).toMatch(/^mock-acesso\./))
    const salvo = localStorage.getItem(CHAVE_SESSAO) ?? ''
    expect(salvo).not.toContain('mock-acesso')
    expect(salvo).toContain('refresh_token')
  })

  it('renovação recusada com 401 encerra a sessão', async () => {
    simularSessao()
    vi.spyOn(clienteMock, 'renovar').mockRejectedValue(new ErroApi(401, 'Sessão expirada.'))

    montar()

    expect(screen.getByText('sessão: Ana Viajante')).toBeInTheDocument()
    expect(await screen.findByText('sem sessão')).toBeInTheDocument()
    expect(lerSessao()).toBeNull()
  })

  it('falha de rede na renovação mantém a sessão local', async () => {
    simularSessao()
    const renovar = vi
      .spyOn(clienteMock, 'renovar')
      .mockRejectedValue(new ErroApi(SEM_REDE, 'Sem conexão.'))

    montar()
    await waitFor(() => expect(renovar).toHaveBeenCalled())
    await act(async () => {}) // deixa o catch da renovação rodar

    expect(screen.getByText('sessão: Ana Viajante')).toBeInTheDocument()
    expect(lerSessao()?.user).toEqual(TURISTA)
  })

  it('offline não tenta renovar, e tenta quando a rede volta', async () => {
    simularSessao()
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    const renovar = vi.spyOn(clienteMock, 'renovar')

    montar()
    expect(screen.getByText('sessão: Ana Viajante')).toBeInTheDocument()
    expect(renovar).not.toHaveBeenCalled()

    online.mockReturnValue(true)
    act(() => {
      window.dispatchEvent(new Event('online'))
    })
    await waitFor(() => expect(renovar).toHaveBeenCalledTimes(1))
  })

  it('ignora sessão salva com formato inválido', () => {
    localStorage.setItem(CHAVE_SESSAO, JSON.stringify({ user: { name: 'sem id' } }))
    montar()
    expect(screen.getByText('sem sessão')).toBeInTheDocument()
  })
})

describe('destinoAposLogin', () => {
  it('aceita só caminho interno', () => {
    expect(destinoAposLogin({ de: '/passaporte?aba=missoes' })).toBe('/passaporte?aba=missoes')
    expect(destinoAposLogin({ de: '//site-malicioso.example' })).toBe('/')
    expect(destinoAposLogin({ de: 'https://site-malicioso.example' })).toBe('/')
    expect(destinoAposLogin({ de: '/entrar' })).toBe('/')
    expect(destinoAposLogin(null)).toBe('/')
  })
})
