import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { routes } from './routes'

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(<RouterProvider router={router} />)
}

describe('app shell', () => {
  it('mostra o mapa na rota inicial com a navegação principal', () => {
    renderAt('/')
    expect(screen.getByRole('heading', { name: 'Mapa' })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Navegação principal' })).toBeInTheDocument()
  })

  it('abre o passaporte pela rota', () => {
    renderAt('/passaporte')
    expect(screen.getByRole('heading', { name: 'Passaporte' })).toBeInTheDocument()
  })
})
