import { describe, expect, it } from 'vitest'
import { COR } from './cores'
import { CENTRO_DA_VILA, LIMITES, montarEstilo, ZOOM_INICIAL, ZOOM_MINIMO } from './estilo'

const ORIGEM = 'https://app.algodoal.example'
const estilo = montarEstilo('pmtiles://chave', ORIGEM)
type Camada = { id: string; type: string; paint?: Record<string, unknown> }
const camadas = estilo.layers as Camada[]
const cor = (id: string, propriedade: string) => camadas.find((c) => c.id === id)?.paint?.[propriedade]

describe('estilo do mapa', () => {
  it('pinta fundo, água, vegetação e praia com os tokens', () => {
    expect(cor('background', 'background-color')).toBe(COR.fundo)
    expect(cor('earth', 'fill-color')).toBe(COR.fundo)
    expect(cor('water', 'fill-color')).toBe(COR.mapaAgua)
    const json = JSON.stringify(estilo.layers)
    expect(json).toContain(COR.mapaVegetacao)
    expect(json).toContain(COR.mapaPraia)
  })

  it('serve glifos e sprite do próprio app, sem CDN', () => {
    expect(estilo.glyphs).toBe(`${ORIGEM}/mapa/glifos/{fontstack}/{range}.pbf`)
    expect(estilo.sprite).toBe(`${ORIGEM}/mapa/sprites/light`)
    // Nenhuma URL fora do app, a não ser os links da atribuição
    const urls = JSON.stringify(estilo).match(/https?:\/\/[^"'/\s]+/g) ?? []
    for (const url of urls) {
      expect([ORIGEM, 'https://www.openstreetmap.org', 'https://protomaps.com']).toContain(url)
    }
  })

  it('credita o OpenStreetMap (ODbL)', () => {
    const fonte = estilo.sources.algodoal as { attribution?: string; url?: string }
    expect(fonte.attribution).toContain('© OpenStreetMap contributors')
    expect(fonte.attribution).toContain('https://www.openstreetmap.org/copyright')
    expect(fonte.url).toBe('pmtiles://chave')
  })

  it('abre na vila, dentro do recorte do arquivo', () => {
    const [[oeste, sul], [leste, norte]] = LIMITES as [[number, number], [number, number]]
    const [lng, lat] = CENTRO_DA_VILA
    expect(lng).toBeGreaterThan(oeste)
    expect(lng).toBeLessThan(leste)
    expect(lat).toBeGreaterThan(sul)
    expect(lat).toBeLessThan(norte)
    expect(ZOOM_INICIAL).toBe(14)
    expect(ZOOM_MINIMO).toBeGreaterThanOrEqual(10) // glifos 0-255 bastam do 10 para cima
  })
})
