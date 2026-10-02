import { Marker, type Map as MapaLibre } from 'maplibre-gl'
import { porId, raizDaCategoria } from '../../lib/categorias'
import type { Categoria, Local, TipoLocal } from '../../lib/tipos'
import { classeDoGrupo } from './cores'
import { CAMINHOS_DO_TIPO, TIPOS } from './icones'

function duracao(): number {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 0 : 300
}

export interface MarcadorNoMapa {
  id: string
  elemento: HTMLButtonElement
  marker: Marker
}

const SVG = 'http://www.w3.org/2000/svg'

/**
 * O ícone do tipo como SVG de DOM (o marcador vive fora do React): os mesmos traços do
 * componente da legenda (icones.tsx), em currentColor — branco, pelo CSS do pino.
 */
function iconeDoTipo(tipo: TipoLocal): SVGSVGElement {
  const svg = document.createElementNS(SVG, 'svg')
  for (const [atributo, valor] of Object.entries({
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': '2',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'aria-hidden': 'true',
    focusable: 'false',
  })) {
    svg.setAttribute(atributo, valor)
  }
  for (const d of CAMINHOS_DO_TIPO[tipo] ?? []) {
    const caminho = document.createElementNS(SVG, 'path')
    caminho.setAttribute('d', d)
    svg.append(caminho)
  }
  return svg
}

/**
 * Um <button> por local: 48x48 de alvo de toque e, no centro, um pino de 32px na cor do grupo
 * do tipo, com o ícone branco. No aria-label, nome e tipo ("Praia do Sol Deitado, praia"): a
 * cor nunca é a única pista. Sendo <button>, chega-se com Tab e abre com Enter ou espaço.
 */
export function criarMarcadores(
  mapa: MapaLibre,
  locais: Local[],
  categorias: Categoria[],
  aoTocar: (id: string) => void,
): MarcadorNoMapa[] {
  const categoriaPorId = porId(categorias)
  return locais.map((local) => {
    const raiz = raizDaCategoria(categoriaPorId, local.category_id)
    // Tipo desconhecido (API mais nova que o app): pino neutro, sem ícone, em vez de quebrar o mapa.
    const tipo = TIPOS[local.kind] as (typeof TIPOS)[TipoLocal] | undefined
    const elemento = document.createElement('button')
    elemento.type = 'button'
    elemento.className = 'marcador'
    elemento.dataset.localId = local.id
    elemento.dataset.categoria = raiz?.slug ?? ''
    elemento.dataset.tipo = local.kind
    elemento.dataset.grupo = tipo?.grupo ?? ''
    elemento.setAttribute(
      'aria-label',
      [local.name, tipo?.rotulo.toLocaleLowerCase('pt-BR')].filter(Boolean).join(', '),
    )
    const pino = document.createElement('span')
    // A cor vem da classe do grupo (mapa.css); sem tipo conhecido, fica a cor neutra.
    pino.className = tipo ? `marcador__pino ${classeDoGrupo(tipo.grupo)}` : 'marcador__pino'
    pino.append(iconeDoTipo(local.kind))
    elemento.append(pino)
    elemento.setAttribute('aria-pressed', 'false')
    elemento.addEventListener('click', (evento) => {
      evento.stopPropagation() // não deixa o clique chegar ao mapa (que fecharia o card)
      aoTocar(local.id)
    })
    // Navegando com Tab, o foco pode cair num marcador fora da área visível (o mapa recorta):
    // aí o mapa desliza até ele, em vez de focar algo que não se vê.
    elemento.addEventListener('focus', () => {
      if (!mapa.getBounds().contains([local.longitude, local.latitude])) {
        mapa.easeTo({ center: [local.longitude, local.latitude], duration: duracao() })
      }
    })
    const marker = new Marker({ element: elemento, anchor: 'center' })
      .setLngLat([local.longitude, local.latitude])
      .addTo(mapa)
    return { id: local.id, elemento, marker }
  })
}

export function removerMarcadores(marcadores: MarcadorNoMapa[]): void {
  for (const { marker } of marcadores) marker.remove()
}

export function marcarSelecionado(marcadores: MarcadorNoMapa[], selecionado: string | null) {
  for (const { id, elemento } of marcadores) {
    elemento.setAttribute('aria-pressed', String(id === selecionado))
  }
}
