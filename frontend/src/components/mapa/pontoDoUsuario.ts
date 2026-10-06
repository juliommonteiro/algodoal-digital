import { Marker, type Map as MapaLibre } from 'maplibre-gl'
import { raioEmPixels } from './localizacao'

export interface PontoDoUsuario {
  /** Move o ponto e redimensiona o halo da precisão. */
  mover(longitude: number, latitude: number, precisao: number): void
  mostrar(visivel: boolean): void
  remover(): void
}

/**
 * O "você está aqui": ponto azul com anel branco e, em volta, o halo translúcido do raio de
 * precisão. Marcador de DOM, como os dos locais; não recebe foco nem clique (só informa). O
 * halo acompanha o zoom: o mesmo raio em metros ocupa mais pixels quando o mapa aproxima.
 */
export function criarPontoDoUsuario(mapa: MapaLibre): PontoDoUsuario {
  const elemento = document.createElement('div')
  elemento.className = 'eu'
  elemento.setAttribute('role', 'img')
  elemento.setAttribute('aria-label', 'Você está aqui')
  const halo = document.createElement('div')
  halo.className = 'eu__halo'
  const ponto = document.createElement('div')
  ponto.className = 'eu__ponto'
  elemento.append(halo, ponto)

  let atual: { latitude: number; precisao: number } | null = null
  const redimensionar = () => {
    if (!atual) return
    const diametro = 2 * raioEmPixels(atual.precisao, atual.latitude, mapa.getZoom())
    halo.style.width = halo.style.height = `${Math.round(diametro)}px`
  }
  mapa.on('zoom', redimensionar)

  const marker = new Marker({ element: elemento, anchor: 'center' })
  let noMapa = false

  return {
    mover(longitude, latitude, precisao) {
      atual = { latitude, precisao }
      marker.setLngLat([longitude, latitude])
      if (!noMapa) {
        marker.addTo(mapa)
        noMapa = true
      }
      redimensionar()
    },
    mostrar(visivel) {
      elemento.hidden = !visivel
    },
    remover() {
      mapa.off('zoom', redimensionar)
      marker.remove()
      noMapa = false
    },
  }
}
