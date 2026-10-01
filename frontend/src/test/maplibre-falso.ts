/**
 * MapLibre de mentira para o jsdom (sem WebGL): mesmas classes que o app usa, sem desenhar.
 * Guarda o que o componente pediu — opções, controles, marcadores — para os testes conferirem.
 */
import { vi } from 'vitest'

type Ouvinte = (evento: unknown) => void

export const mapasCriados: MapaFalso[] = []

class MapaFalso {
  readonly opcoes: Record<string, unknown>
  readonly container: HTMLElement
  readonly controles: { controle: unknown; posicao?: string }[] = []
  readonly ouvintes: Record<string, Ouvinte[]> = {}
  removido = false
  readonly touchZoomRotate = { disableRotation: vi.fn() }
  readonly easeTo = vi.fn()

  constructor(opcoes: Record<string, unknown> & { container: HTMLElement }) {
    this.opcoes = opcoes
    this.container = opcoes.container
    mapasCriados.push(this)
  }

  on(evento: string, ouvinte: Ouvinte) {
    ;(this.ouvintes[evento] ??= []).push(ouvinte)
    return this
  }

  addControl(controle: unknown, posicao?: string) {
    this.controles.push({ controle, posicao })
    return this
  }

  getBounds() {
    return { contains: () => true }
  }

  remove() {
    this.removido = true
  }

  disparar(evento: string) {
    for (const ouvinte of this.ouvintes[evento] ?? []) ouvinte({})
  }
}

class MarcadorFalso {
  readonly elemento: HTMLElement
  lngLat: [number, number] | null = null

  constructor(opcoes: { element: HTMLElement }) {
    this.elemento = opcoes.element
  }

  setLngLat(lngLat: [number, number]) {
    this.lngLat = lngLat
    return this
  }

  addTo(mapa: MapaFalso) {
    mapa.container.appendChild(this.elemento)
    return this
  }

  remove() {
    this.elemento.remove()
  }
}

class ControleFalso {
  readonly opcoes: unknown
  constructor(opcoes?: unknown) {
    this.opcoes = opcoes
  }
}

export {
  ControleFalso as AttributionControl,
  MapaFalso as Map,
  MarcadorFalso as Marker,
  ControleFalso as NavigationControl,
}
export type { MapaFalso }
export const addProtocol = vi.fn()
export const setWorkerUrl = vi.fn()
