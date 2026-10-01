import 'maplibre-gl/dist/maplibre-gl.css'
import './mapa.css'
import { AttributionControl, Map as MapaLibre, NavigationControl } from 'maplibre-gl'
import { useEffect, useRef } from 'react'
import type { Categoria, Local } from '../../lib/tipos'
import { useCarregar } from '../../lib/useCarregar'
import { carregarArquivoDoMapa, chaveDoArquivo } from './arquivo'
import { AvisoDoMapa } from './AvisoDoMapa'
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
import { registrarArquivo } from './protocolo'

function prefereMenosMovimento(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

/**
 * Mapa da ilha: MapLibre lendo o PMTiles do próprio app, que vem no precache do service worker
 * — funciona offline desde a instalação. Carregado sob demanda (lazy) e envolvido por
 * LimiteDoMapa, que mostra um aviso se algo aqui falhar (ex.: sem WebGL).
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
  // O arquivo inteiro, uma vez por sessão (do precache, se offline).
  const arquivo = useCarregar('mapa:arquivo', carregarArquivoDoMapa)
  const dados = arquivo.status === 'ok' ? arquivo.dados : null

  useEffect(() => {
    if (!container.current || !dados) return
    const chave = chaveDoArquivo()
    registrarArquivo(chave, dados)
    // Sem WebGL o construtor lança; o erro sobe para LimiteDoMapa, que avisa.
    const mapa = new MapaLibre({
      container: container.current,
      style: montarEstilo(`pmtiles://${chave}`),
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
  }, [dados])

  // Marcadores: refeitos quando a lista filtrada muda (chips, busca) — tudo no cliente.
  useEffect(() => {
    const mapa = mapaRef.current
    if (!mapa || !dados) return
    marcadores.current = criarMarcadores(mapa, locais, categorias, (id) =>
      aoSelecionarRef.current(id),
    )
    return () => removerMarcadores(marcadores.current)
  }, [locais, categorias, dados])

  useEffect(() => {
    marcarSelecionado(marcadores.current, selecionado)
  }, [selecionado, locais])

  if (arquivo.status === 'carregando') {
    return <div className="mapa mapa--carregando" aria-busy="true" aria-label="Carregando o mapa" />
  }

  if (arquivo.status === 'erro') {
    return <AvisoDoMapa motivo="sem-arquivo" aoTentarDeNovo={arquivo.recarregar} />
  }

  return <div ref={container} className="mapa" role="region" aria-label="Mapa da ilha" />
}
