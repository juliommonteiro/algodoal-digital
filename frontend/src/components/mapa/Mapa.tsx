import 'maplibre-gl/dist/maplibre-gl.css'
import './mapa.css'
import { AttributionControl, Map as MapaLibre, NavigationControl } from 'maplibre-gl'
import { useEffect, useRef } from 'react'
import type { Categoria, Local } from '../../lib/tipos'
import {
  CENTRO_DA_VILA,
  CREDITO_PROTOMAPS,
  LIMITES,
  montarEstilo,
  ZOOM_INICIAL,
  ZOOM_MAXIMO,
  ZOOM_MINIMO,
} from './estilo'
import {
  criarMarcadores,
  marcarSelecionado,
  removerMarcadores,
  type MarcadorNoMapa,
} from './marcadores'
import { protocoloPmtiles } from './protocolo'

const URL_DO_ARQUIVO = '/mapa/algodoal.pmtiles'

function prefereMenosMovimento(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

/**
 * Mapa da ilha: MapLibre lendo o PMTiles do próprio app. Carregado sob demanda (lazy) e
 * envolvido por LimiteDoMapa, que mostra um aviso se algo aqui falhar (ex.: sem WebGL).
 */
export interface MapaProps {
  /** Já filtrados pela tela (chips e busca): o mapa só desenha. */
  locais: Local[]
  categorias: Categoria[]
  selecionado: string | null
  aoSelecionar: (id: string | null) => void
}

export default function Mapa({ locais, categorias, selecionado, aoSelecionar }: MapaProps) {
  const container = useRef<HTMLDivElement>(null)
  const mapaRef = useRef<MapaLibre | null>(null)
  const marcadores = useRef<MarcadorNoMapa[]>([])
  // O callback muda a cada render da tela; os marcadores leem sempre o mais recente.
  const aoSelecionarRef = useRef(aoSelecionar)
  useEffect(() => {
    aoSelecionarRef.current = aoSelecionar
  })

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
    // Tocar fora de um marcador fecha o card.
    mapa.on('click', () => aoSelecionarRef.current(null))
    mapaRef.current = mapa
    return () => {
      mapaRef.current = null
      marcadores.current = []
      mapa.remove()
    }
  }, [])

  // Marcadores: refeitos quando a lista filtrada muda (chips, busca) — tudo no cliente.
  useEffect(() => {
    const mapa = mapaRef.current
    if (!mapa) return
    marcadores.current = criarMarcadores(mapa, locais, categorias, (id) =>
      aoSelecionarRef.current(id),
    )
    return () => removerMarcadores(marcadores.current)
  }, [locais, categorias])

  useEffect(() => {
    marcarSelecionado(marcadores.current, selecionado)
  }, [selecionado, locais])

  return <div ref={container} className="mapa" role="region" aria-label="Mapa da ilha" />
}
