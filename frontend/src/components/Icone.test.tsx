import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Icone } from './Icone'

describe('Icone em linha (seta e conferido)', () => {
  it.each([
    ['seta', 'M3 10h13m-4.5-4.5L16 10l-4.5 4.5'],
    ['conferido', 'M4 10.5l4 4 8-8'],
  ] as const)('%s é SVG decorativo de 1em, grid 20x20, traço 1.5 em currentColor', (nome, d) => {
    const { container } = render(<Icone nome={nome} />)
    const svg = container.querySelector('svg')!

    expect(svg).toHaveAttribute('aria-hidden', 'true')
    expect(svg).toHaveAttribute('width', '1em')
    expect(svg).toHaveAttribute('height', '1em')
    expect(svg).toHaveAttribute('viewBox', '0 0 20 20')
    expect(svg).toHaveAttribute('stroke', 'currentColor')
    expect(svg).toHaveAttribute('stroke-width', '1.5')
    expect(svg).toHaveAttribute('stroke-linecap', 'round')
    expect(svg).toHaveAttribute('stroke-linejoin', 'round')
    expect(svg.querySelector('path')).toHaveAttribute('d', d)
  })

  it('os ícones de 24px continuam iguais', () => {
    const { container } = render(<Icone nome="mapa" />)
    const svg = container.querySelector('svg')!
    expect(svg).toHaveAttribute('width', '24')
    expect(svg).toHaveAttribute('viewBox', '0 0 24 24')
    expect(svg).toHaveAttribute('stroke-width', '1.75')
    expect(svg).not.toHaveAttribute('class')
  })
})
