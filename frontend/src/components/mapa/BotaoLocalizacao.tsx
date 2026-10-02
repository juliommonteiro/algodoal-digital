import type { Map as MapaLibre } from 'maplibre-gl'
import { useEffect, useRef, useState } from 'react'
import { Icone } from '../Icone'
import {
  decidirPosicao,
  MENSAGENS,
  impedimentoDoNavegador,
  OPCOES_DA_PRIMEIRA_POSICAO,
  OPCOES_DO_ACOMPANHAMENTO,
  resultadoDoErro,
  resultadoDoErroAcompanhando,
  type EstadoDaLocalizacao,
} from './localizacao'
import { criarPontoDoUsuario, type PontoDoUsuario } from './pontoDoUsuario'

const ROTULO: Record<EstadoDaLocalizacao, string> = {
  ocioso: 'Mostrar minha localização',
  buscando: 'Buscando sua localização…',
  ativo: 'Parar de mostrar minha localização',
  bloqueado: 'Localização indisponível — tocar para tentar de novo',
}

function prefereMenosMovimento(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

/**
 * Botão "onde estou". A permissão só é pedida quando a pessoa toca: nada roda ao abrir a
 * página (nem navigator.permissions.query). Depois da primeira posição, acompanha com
 * watchPosition enquanto estiver ativo; desligar ou sair da tela do mapa encerra o
 * acompanhamento (clearWatch) — um watch esquecido gasta bateria. Sem rede funciona igual:
 * o GPS não depende dela, e nada aqui chama a API.
 */
export function BotaoLocalizacao({ obterMapa }: { obterMapa: () => MapaLibre | null }) {
  const [estado, setEstado] = useState<EstadoDaLocalizacao>('ocioso')
  const [aviso, setAviso] = useState<string | null>(null)
  const acompanhamento = useRef<number | null>(null)
  const ponto = useRef<PontoDoUsuario | null>(null)
  // Cada toque abre um pedido novo; resposta de pedido antigo (cancelado) é ignorada.
  const pedido = useRef(0)

  function parar() {
    pedido.current += 1
    if (acompanhamento.current !== null) {
      navigator.geolocation.clearWatch(acompanhamento.current)
      acompanhamento.current = null
    }
    ponto.current?.remover()
    ponto.current = null
  }

  // Saiu da tela do mapa: encerra o acompanhamento e tira o ponto.
  useEffect(() => parar, [])

  // O aviso fica abaixo do mapa: num celular pequeno cairia atrás da barra de abas, então a
  // página rola o mínimo para ele aparecer (sem animação para quem prefere menos movimento).
  const areaDoAviso = useRef<HTMLDivElement>(null)
  const temTexto = estado === 'buscando' || aviso !== null
  useEffect(() => {
    if (!temTexto) return
    areaDoAviso.current?.scrollIntoView?.({
      block: 'nearest',
      behavior: prefereMenosMovimento() ? 'auto' : 'smooth',
    })
  }, [temTexto, aviso])

  function aplicar(posicao: GeolocationPosition, mapa: MapaLibre, primeira: boolean) {
    const decisao = decidirPosicao(posicao.coords)
    if (!decisao.dentro) {
      // Fora do recorte: o mapa fica na ilha. Acompanhando, o ponto some até voltar.
      ponto.current?.mostrar(false)
      setAviso(decisao.aviso)
      return false
    }
    ponto.current ??= criarPontoDoUsuario(mapa)
    ponto.current.mover(decisao.centro[0], decisao.centro[1], decisao.precisao)
    ponto.current.mostrar(true)
    setAviso(null)
    if (primeira) {
      mapa.easeTo({
        center: decisao.centro,
        zoom: decisao.zoom,
        duration: prefereMenosMovimento() ? 0 : 600,
      })
    }
    return true
  }

  function acompanhar(mapa: MapaLibre, este: number) {
    acompanhamento.current = navigator.geolocation.watchPosition(
      (posicao) => {
        if (este === pedido.current) aplicar(posicao, mapa, false)
      },
      (erro) => {
        if (este !== pedido.current) return
        const resultado = resultadoDoErroAcompanhando(erro.code)
        if (resultado.estado === 'bloqueado') parar()
        setEstado(resultado.estado)
        setAviso(resultado.aviso)
      },
      OPCOES_DO_ACOMPANHAMENTO,
    )
  }

  function alternar() {
    // Ligado (ou ainda buscando): o toque desliga.
    if (estado === 'ativo' || estado === 'buscando') {
      parar()
      setEstado('ocioso')
      setAviso(null)
      return
    }
    const mapa = obterMapa()
    if (!mapa) return
    const impedimento = impedimentoDoNavegador({
      temGeolocalizacao: 'geolocation' in navigator,
      contextoSeguro: window.isSecureContext,
    })
    if (impedimento) {
      setEstado(impedimento.estado)
      setAviso(impedimento.aviso)
      return
    }

    parar()
    const este = pedido.current
    setEstado('buscando')
    setAviso(null)
    navigator.geolocation.getCurrentPosition(
      (posicao) => {
        if (este !== pedido.current) return
        if (aplicar(posicao, mapa, true)) {
          setEstado('ativo')
          acompanhar(mapa, este)
        } else {
          setEstado('ocioso')
        }
      },
      (erro) => {
        if (este !== pedido.current) return
        const resultado = resultadoDoErro(erro.code)
        setEstado(resultado.estado)
        setAviso(resultado.aviso)
      },
      OPCOES_DA_PRIMEIRA_POSICAO,
    )
  }

  return (
    <>
      <button
        type="button"
        className="localizacao__botao"
        data-estado={estado}
        aria-label={ROTULO[estado]}
        aria-pressed={estado === 'ativo'}
        aria-busy={estado === 'buscando' || undefined}
        onClick={alternar}
      >
        <Icone nome={estado === 'bloqueado' ? 'miraBloqueada' : 'mira'} />
      </button>
      {/* Logo abaixo do mapa, e não por cima: não cobre marcador nem esbarra na legenda aberta.
          O leitor de tela anuncia quando aparece. Buscando, explica a espera (o primeiro fix
          sem rede demora); os avisos ficam até a pessoa fechar — nenhum some sozinho. */}
      <div ref={areaDoAviso} className="localizacao__aviso" role="status" aria-live="polite">
        {estado === 'buscando' ? (
          <p className="localizacao__texto">{MENSAGENS.buscando}</p>
        ) : (
          aviso && (
            <div className="localizacao__caixa">
              <p className="localizacao__texto">{aviso}</p>
              <button
                type="button"
                className="localizacao__fechar"
                aria-label="Fechar aviso"
                onClick={() => setAviso(null)}
              >
                <Icone nome="fechar" tamanho={18} />
              </button>
            </div>
          )
        )}
      </div>
    </>
  )
}
