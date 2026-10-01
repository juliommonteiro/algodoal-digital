import { describe, expect, it } from 'vitest'
import tokensCss from '../../styles/tokens.css?raw'
import { COR, COR_DA_CATEGORIA, TOKEN_DA_COR } from './cores'

// O primeiro bloco :root do tokens.css tem os fallbacks em hex de cada token.
const raiz = tokensCss.slice(tokensCss.indexOf(':root {'), tokensCss.indexOf('}'))
const hexDoToken = new Map(
  [...raiz.matchAll(/(--[a-z0-9-]+):\s*(#[0-9a-f]{6});/gi)].map(([, nome, hex]) => [
    nome,
    hex.toLowerCase(),
  ]),
)

describe('cores do mapa', () => {
  it('são exatamente os valores do tokens.css', () => {
    for (const [chave, valor] of Object.entries(COR)) {
      const token = TOKEN_DA_COR[chave as keyof typeof COR]
      expect(hexDoToken.get(token), `${chave} (${token})`).toBe(valor)
    }
  })

  it('os marcadores só usam cores do tokens.css', () => {
    const permitidas = new Set<string>(Object.values(COR))
    for (const [categoria, cor] of Object.entries(COR_DA_CATEGORIA)) {
      expect(permitidas.has(cor), categoria).toBe(true)
    }
  })

  it('cobre as seis categorias de primeiro nível', () => {
    expect(Object.keys(COR_DA_CATEGORIA).sort()).toEqual(
      ['alimentacao', 'cultura', 'hospedagem', 'preservacao', 'servicos', 'turismo'].sort(),
    )
  })
})
