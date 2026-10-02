import { describe, expect, it } from 'vitest'
import tokensCss from '../../styles/tokens.css?raw'
import { COR, TOKEN_DA_COR } from './cores'

// O primeiro bloco :root do tokens.css tem os fallbacks de cada token: um hex, ou um apelido
// var(--outro) para uma cor que já existe.
const raiz = tokensCss.slice(tokensCss.indexOf(':root {'), tokensCss.indexOf('}'))
const hexProprio = new Map(
  [...raiz.matchAll(/(--[a-z0-9-]+):\s*(#[0-9a-f]{6});/gi)].map(([, nome, hex]) => [
    nome,
    hex.toLowerCase(),
  ]),
)
const apelidos = new Map(
  [...raiz.matchAll(/(--[a-z0-9-]+):\s*var\((--[a-z0-9-]+)\);/gi)].map(([, nome, alvo]) => [
    nome,
    alvo,
  ]),
)
/** Hex de um token, seguindo os apelidos. */
const hexDoToken = (token: string): string | undefined =>
  hexProprio.get(token) ?? (apelidos.has(token) ? hexDoToken(apelidos.get(token)!) : undefined)
// O bloco @supports, com as versões em OKLCH.
const blocoOklch = tokensCss.slice(tokensCss.indexOf('@supports ('))

describe('cores do mapa', () => {
  it('são exatamente os valores do tokens.css', () => {
    for (const [chave, valor] of Object.entries(COR)) {
      const token = TOKEN_DA_COR[chave as keyof typeof COR]
      expect(hexDoToken(token), `${chave} (${token})`).toBe(valor)
    }
  })

  it('--mangue e --terra são apelidos de --verde-fundo e --terracota, sem versão OKLCH própria', () => {
    expect(apelidos.get('--mangue')).toBe('--verde-fundo')
    expect(apelidos.get('--terra')).toBe('--terracota')
    // Redefinir no @supports quebraria o apelido: em OKLCH, o pino deixaria de acompanhar.
    expect(blocoOklch).not.toMatch(/--mangue:|--terra:/)
  })

  it('a paleta não repete hex: a mesma cor tem um token só', () => {
    const hexes = [...hexProprio.values()]
    const repetidos = hexes.filter((hex, i) => hexes.indexOf(hex) !== i)
    expect(repetidos).toEqual([])
  })
})
