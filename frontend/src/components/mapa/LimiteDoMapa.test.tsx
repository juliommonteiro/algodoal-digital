import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { LimiteDoMapa } from './LimiteDoMapa'

function Explode({ erro }: { erro: Error | null }) {
  if (erro) throw erro
  return <p>mapa aberto</p>
}

describe('LimiteDoMapa', () => {
  it('código do mapa que não veio: avisa e, sem rede, não recarrega', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    const recarregar = vi.fn()
    const erro = new Error('Unable to preload CSS for http://localhost/assets/Mapa-abc.css')
    render(
      <LimiteDoMapa recarregar={recarregar}>
        <Explode erro={erro} />
      </LimiteDoMapa>,
    )

    expect(screen.getByRole('heading', { name: 'O mapa ainda não foi baixado' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))

    expect(recarregar).not.toHaveBeenCalled()
    expect(screen.getByText('Ainda sem conexão. Tente quando houver sinal.')).toBeInTheDocument()
  })

  it('código do mapa que não veio, com a rede de volta: recarrega a página', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const recarregar = vi.fn()
    render(
      <LimiteDoMapa recarregar={recarregar}>
        <Explode erro={new TypeError('error loading dynamically imported module: /assets/Mapa.js')} />
      </LimiteDoMapa>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))

    expect(recarregar).toHaveBeenCalledTimes(1)
  })

  it('com rede, outra falha (ex.: sem WebGL) diz que não conseguiu desenhar', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { rerender } = render(
      <LimiteDoMapa>
        <Explode erro={new Error('Failed to initialize WebGL')} />
      </LimiteDoMapa>,
    )

    expect(screen.getByRole('heading', { name: 'Não foi possível desenhar o mapa' })).toBeInTheDocument()

    rerender(
      <LimiteDoMapa>
        <Explode erro={null} />
      </LimiteDoMapa>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(screen.getByText('mapa aberto')).toBeInTheDocument()
  })
})
