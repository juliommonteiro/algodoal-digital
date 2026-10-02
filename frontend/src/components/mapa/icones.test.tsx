import { render } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ROTULO_TIPO } from '../../lib/formatos'
import type { TipoLocal } from '../../lib/tipos'
import { contraste, hexDoToken } from '../../test/tokens'
import mapaCss from './mapa.css?raw'
import { classeDoGrupo } from './cores'
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

/** Token que pinta cada classe de grupo no mapa.css (.pino--explorar { background-color: var(--mar) }). */
const tokenDaClasse = new Map(
  [...mapaCss.matchAll(/\.(pino--[a-z]+) \{\s*background-color: var\((--[a-z-]+)\);/g)].map(
    ([, classe, token]) => [classe, token],
  ),
)

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

  it('agrupa os tipos, e cada grupo pinta o pino com o seu token', () => {
    const esperado: Record<TipoLocal, string> = {
      beach: 'explorar',
      trail: 'explorar',
      tourist_point: 'explorar',
      business: 'economia',
      experience: 'economia',
      collection_point: 'ambiental',
      culture: 'cultura',
    }
    for (const tipo of SETE_TIPOS) expect(TIPOS[tipo].grupo, tipo).toBe(esperado[tipo])

    const tokenDoGrupo = Object.fromEntries(
      Object.keys(GRUPOS).map((grupo) => [
        grupo,
        tokenDaClasse.get(classeDoGrupo(grupo as keyof typeof GRUPOS)),
      ]),
    )
    expect(tokenDoGrupo).toEqual({
      explorar: '--mar',
      economia: '--sol',
      ambiental: '--mangue',
      cultura: '--terra',
    })
  })

  it('o ícone branco sobre cada cor de grupo tem contraste de 4,5:1 ou mais', () => {
    const contrastes = Object.fromEntries(
      Object.keys(GRUPOS).map((grupo) => {
        const token = tokenDaClasse.get(classeDoGrupo(grupo as keyof typeof GRUPOS))!
        const hex = hexDoToken(token)!
        return [grupo, Math.round(contraste('#ffffff', hex) * 10) / 10]
      }),
    )
    // mar 5,9; sol 4,7; mangue = verde-fundo 9,7; terra = terracota 5,8
    expect(contrastes).toEqual({ explorar: 5.9, economia: 4.7, ambiental: 9.7, cultura: 5.8 })
    for (const valor of Object.values(contrastes)) expect(valor).toBeGreaterThanOrEqual(4.5)
  })

  it('os sete SVGs juntos têm no máximo 4 kB (antes do gzip)', () => {
    const marcacao = SETE_TIPOS.map((tipo) => {
      const Icone = TIPOS[tipo].icone
      return renderToStaticMarkup(<Icone />)
    }).join('')
    expect(new TextEncoder().encode(marcacao).length).toBeLessThanOrEqual(4096)
  })
})
