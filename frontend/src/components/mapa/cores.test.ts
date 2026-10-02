import { describe, expect, it } from 'vitest'
import { apelidos, blocoOklch, hexDoToken, hexProprio } from '../../test/tokens'
import { COR, TOKEN_DA_COR } from './cores'

// Todo o TypeScript do frontend, como texto: o app (sem os testes) e o vite.config.ts.
const fontes = import.meta.glob<string>(
  ['/src/**/*.{ts,tsx}', '!/src/**/*.test.{ts,tsx}', '!/src/test/**', '/vite.config.ts'],
  { query: '?raw', import: 'default', eager: true },
)
const HEX = /#(?:[0-9a-f]{6}|[0-9a-f]{3})\b/gi

describe('cores do mapa', () => {
  it('o espelho do MapLibre (cores.ts) tem exatamente os valores do tokens.css', () => {
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

  it('hex de cor em TypeScript só nos espelhos que não leem CSS: MapLibre e manifest', () => {
    expect(Object.keys(fontes).length).toBeGreaterThan(20) // o glob achou o app
    const achados = Object.entries(fontes).flatMap(([arquivo, texto]) =>
      [...texto.matchAll(HEX)].map(([hex]) => `${arquivo}: ${hex.toLowerCase()}`),
    )
    const esperado = [
      // Estilo do MapLibre (JSON): cores.ts, conferido com o tokens.css no primeiro teste.
      ...Object.values(COR).map((hex) => `/src/components/mapa/cores.ts: ${hex}`),
      // Manifest do PWA (JSON gerado no build): background_color e theme_color.
      `/vite.config.ts: ${hexDoToken('--fundo')}`,
      `/vite.config.ts: ${hexDoToken('--verde-fundo')}`,
    ]
    expect(achados.sort()).toEqual(esperado.sort())
  })
})
