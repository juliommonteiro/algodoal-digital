import { render } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { CHAVE_SESSAO, type SessaoSalva } from '../auth/sessao'
import type { Usuario } from '../lib/tipos'
import { routes } from '../routes'

export const TURISTA: Usuario = {
  id: '00000000-0000-4000-c000-000000000001',
  name: 'Ana Viajante',
  email: 'ana.turista@example.com',
  role: 'tourist',
}

/** Conta de teste do seed (backend/scripts/seed.py). */
export const ADMIN: Usuario = {
  id: '00000000-0000-4000-c000-000000000007',
  name: 'Admin de Teste',
  email: 'admin@example.com',
  role: 'admin',
}

/** Simula uma sessão salva por um login anterior (o que o app acha no localStorage ao abrir). */
export function simularSessao(usuario: Usuario = TURISTA): SessaoSalva {
  const sessao: SessaoSalva = {
    refresh_token: `mock-refresh.${btoa(encodeURIComponent(JSON.stringify(usuario)))}`,
    user: usuario,
  }
  localStorage.setItem(CHAVE_SESSAO, JSON.stringify(sessao))
  return sessao
}

export function renderizarEm(caminho: string) {
  const router = createMemoryRouter(routes, { initialEntries: [caminho] })
  render(<RouterProvider router={router} />)
  return router
}

/** Um arquivo PMTiles mínimo: só a assinatura dos 7 primeiros bytes, que é o que o app confere. */
export function pmtilesFalso(): ArrayBuffer {
  return new TextEncoder().encode('PMTiles\u0003 resto do arquivo').buffer as ArrayBuffer
}
