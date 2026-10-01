import { Marker, type Map as MapaLibre } from 'maplibre-gl'
import { porId, raizDaCategoria } from '../../lib/categorias'
import type { Categoria, Local } from '../../lib/tipos'
import { COR_DA_CATEGORIA, COR_SEM_CATEGORIA } from './cores'

function duracao(): number {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 0 : 300
}

export interface MarcadorNoMapa {
  id: string
  elemento: HTMLButtonElement
  marker: Marker
}

/**
 * Um <button> por local: 48x48 de alvo de toque, um ponto de 18px no centro, nome e categoria
 * no aria-label — dá para chegar com Tab e o leitor de tela anuncia o que é.
 */
export function criarMarcadores(
  mapa: MapaLibre,
  locais: Local[],
  categorias: Categoria[],
  aoTocar: (id: string) => void,
): MarcadorNoMapa[] {
  const categoriaPorId = porId(categorias)
  return locais.map((local) => {
    const categoria = categoriaPorId.get(local.category_id)
    const raiz = raizDaCategoria(categoriaPorId, local.category_id)
    const elemento = document.createElement('button')
    elemento.type = 'button'
    elemento.className = 'marcador'
    elemento.dataset.localId = local.id
    elemento.dataset.categoria = raiz?.slug ?? ''
    elemento.style.setProperty(
      '--cor-marcador',
      (raiz && COR_DA_CATEGORIA[raiz.slug]) ?? COR_SEM_CATEGORIA,
    )
    elemento.setAttribute('aria-label', [local.name, categoria?.name].filter(Boolean).join(', '))
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
