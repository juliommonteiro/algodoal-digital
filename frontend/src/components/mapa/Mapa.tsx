import 'maplibre-gl/dist/maplibre-gl.css'
import './mapa.css'
import { AttributionControl, Map as MapaLibre, NavigationControl } from 'maplibre-gl'
import { useEffect, useRef } from 'react'
import {
  CENTRO_DA_VILA,
  CREDITO_PROTOMAPS,
  LIMITES,
  montarEstilo,
  ZOOM_INICIAL,
  ZOOM_MAXIMO,
  ZOOM_MINIMO,
} from './estilo'
import { protocoloPmtiles } from './protocolo'

const URL_DO_ARQUIVO = '/mapa/algodoal.pmtiles'

function prefereMenosMovimento(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

/**
 * Mapa da ilha: MapLibre lendo o PMTiles do próprio app. Carregado sob demanda (lazy) e
 * envolvido por LimiteDoMapa, que mostra um aviso se algo aqui falhar (ex.: sem WebGL).
 */
export default function Mapa() {
  const container = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!container.current) return
    protocoloPmtiles()
    // Sem WebGL o construtor lança; o erro sobe para LimiteDoMapa, que avisa.
    const mapa = new MapaLibre({
      container: container.current,
      style: montarEstilo(`pmtiles://${window.location.origin}${URL_DO_ARQUIVO}`),
      center: CENTRO_DA_VILA,
      zoom: ZOOM_INICIAL,
      minZoom: ZOOM_MINIMO,
      maxZoom: ZOOM_MAXIMO,
      // Não deixa arrastar para fora do que existe no arquivo.
      maxBounds: LIMITES,
      attributionControl: false,
      // Mapa de vila: norte sempre para cima, sem inclinação.
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      fadeDuration: prefereMenosMovimento() ? 0 : 300,
    })
    mapa.touchZoomRotate.disableRotation()
    mapa.addControl(new NavigationControl({ showCompass: false }), 'top-right')
    // compact: false — a atribuição do OSM fica sempre aberta, sem o botão que a esconde.
    mapa.addControl(
      new AttributionControl({ compact: false, customAttribution: CREDITO_PROTOMAPS }),
      'bottom-right',
    )
    return () => mapa.remove()
  }, [])

  return <div ref={container} className="mapa" role="region" aria-label="Mapa da ilha" />
}
