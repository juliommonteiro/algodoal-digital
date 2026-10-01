import { layers, namedFlavor } from '@protomaps/basemaps'
import type { LngLatBoundsLike, MapOptions } from 'maplibre-gl'
import { COR } from './cores'

type Estilo = Exclude<MapOptions['style'], string | undefined>

/** Recorte do arquivo de tiles (scripts/gerar-mapa.sh): da ilha até Marudá. */
export const LIMITES: LngLatBoundsLike = [
  [-47.68, -0.66],
  [-47.51, -0.56],
]

/** "Algodoal" (place, kind=locality) no próprio arquivo de tiles. [lng, lat] */
export const CENTRO_DA_VILA: [number, number] = [-47.58609, -0.59219]

export const ZOOM_INICIAL = 14
/** Do 10 para cima todos os nomes do recorte cabem nos glifos 0-255 que o app serve. */
export const ZOOM_MINIMO = 10
/** Os tiles vão até o 15; acima disso o MapLibre amplia a geometria vetorial, sem borrar. */
export const ZOOM_MAXIMO = 18

/** Exigência da licença ODbL: visível, sem como esconder (AttributionControl compact:false). */
export const ATRIBUICAO_OSM =
  '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">' +
  '© OpenStreetMap contributors</a>'
export const CREDITO_PROTOMAPS =
  '<a href="https://protomaps.com" target="_blank" rel="noopener">Protomaps</a>'

export const ID_DA_FONTE = 'algodoal'

/**
 * Estilo da Protomaps (flavor light) com as cores do projeto: fundo no creme, água no azul de
 * maré, vegetação no verde de mangue, praia na areia — todos de tokens.css. Glifos e sprite
 * vêm do próprio app (public/mapa/), não de CDN: o mapa tem de funcionar offline.
 */
export function montarEstilo(urlDaFonte: string, origem = window.location.origin): Estilo {
  const base = namedFlavor('light')
  const sabor = {
    ...base,
    background: COR.fundo,
    earth: COR.fundo,
    water: COR.mapaAgua,
    park_a: COR.mapaVegetacao,
    park_b: COR.mapaVegetacao,
    wood_a: COR.mapaVegetacao,
    wood_b: COR.mapaVegetacao,
    scrub_a: COR.mapaVegetacao,
    scrub_b: COR.mapaVegetacao,
    sand: COR.mapaPraia,
    beach: COR.mapaPraia,
    buildings: COR.borda,
    // Cobertura do solo nos zooms baixos: mesma paleta, para a ilha não mudar de cor ao aproximar.
    landcover: {
      grassland: COR.mapaVegetacao,
      farmland: COR.mapaVegetacao,
      scrub: COR.mapaVegetacao,
      forest: COR.mapaVegetacao,
      barren: COR.mapaPraia,
      urban_area: COR.fundo,
      glacier: COR.superficie,
    },
  }
  return {
    version: 8,
    // URLs absolutas: o MapLibre resolve parte dos recursos fora da página (workers).
    glyphs: `${origem}/mapa/glifos/{fontstack}/{range}.pbf`,
    sprite: `${origem}/mapa/sprites/light`,
    sources: {
      [ID_DA_FONTE]: {
        type: 'vector',
        url: urlDaFonte,
        attribution: ATRIBUICAO_OSM,
      },
    },
    layers: layers(ID_DA_FONTE, sabor, { lang: 'pt' }),
  }
}
