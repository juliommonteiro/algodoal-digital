import { render } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ROTULO_TIPO } from '../../lib/formatos'
import type { TipoLocal } from '../../lib/tipos'
import { COR } from './cores'
import { CAMINHOS_DO_TIPO, GRUPOS, TIPOS } from './icones'

// Os sete valores do enum PlaceKind do backend (app/schemas/place.py).
const SETE_TIPOS: TipoLocal[] = [
  'beach',
  'trail',
  'tourist_point',
  'business',
  'experience',
  'collection_point',
  'culture',
]

/** Contraste WCAG 2 entre duas cores em hex. */
function contraste(a: string, b: string): number {
  const luminancia = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl
  }
  const [claro, escuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x)
  return (claro + 0.05) / (escuro + 0.05)
}

describe('ícones dos tipos de local', () => {
  it('cobre exatamente os sete tipos', () => {
    expect(Object.keys(TIPOS).sort()).toEqual([...SETE_TIPOS].sort())
    expect(Object.keys(CAMINHOS_DO_TIPO).sort()).toEqual([...SETE_TIPOS].sort())
  })

  it.each(SETE_TIPOS)('%s tem ícone definido, que desenha um SVG com traços', (tipo) => {
    const { icone: Icone, rotulo } = TIPOS[tipo]
    expect(Icone).toBeTypeOf('function')
    expect(CAMINHOS_DO_TIPO[tipo].length).toBeGreaterThan(0)

    const { container } = render(<Icone />)
    const svg = container.querySelector('svg')!
    expect(svg).toHaveAttribute('aria-hidden', 'true')
    expect(svg).toHaveAttribute('stroke', 'currentColor')
    expect(svg.querySelectorAll('path')).toHaveLength(CAMINHOS_DO_TIPO[tipo].length)
    // O mesmo rótulo da lista de locais.
    expect(rotulo).toBe(ROTULO_TIPO[tipo])
  })

  it('agrupa os tipos e dá a cor do grupo', () => {
    const esperado: Record<TipoLocal, [string, string]> = {
      beach: ['explorar', COR.mar],
      trail: ['explorar', COR.mar],
      tourist_point: ['explorar', COR.mar],
      business: ['economia', COR.sol],
      experience: ['economia', COR.sol],
      collection_point: ['ambiental', COR.mangue],
      culture: ['cultura', COR.terra],
    }
    for (const tipo of SETE_TIPOS) {
      expect([TIPOS[tipo].grupo, TIPOS[tipo].cor], tipo).toEqual(esperado[tipo])
    }
    expect(COR).toMatchObject({
      mar: '#1b6c8c',
      sol: '#9a6a17',
      mangue: '#15493a',
      terra: '#a8543a',
    })
  })

  it.each(Object.entries(GRUPOS))(
    'o ícone branco sobre o grupo %s tem contraste de 4,5:1 ou mais',
    (_, { cor }) => {
      expect(contraste('#ffffff', cor)).toBeGreaterThanOrEqual(4.5)
    },
  )

  it('os sete SVGs juntos têm no máximo 4 kB (antes do gzip)', () => {
    const marcacao = SETE_TIPOS.map((tipo) => {
      const Icone = TIPOS[tipo].icone
      return renderToStaticMarkup(<Icone />)
    }).join('')
    expect(new TextEncoder().encode(marcacao).length).toBeLessThanOrEqual(4096)
  })
})
