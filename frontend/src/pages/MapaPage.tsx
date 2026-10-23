import { lazy, Suspense, useEffect, useMemo, useState, type ReactNode } from 'react'
import { FalhaCarga } from '../components/FalhaCarga'
import { FiltrosCatalogo } from '../components/FiltrosCatalogo'
import { CardDoLocal } from '../components/mapa/CardDoLocal'
import { LimiteDoMapa } from '../components/mapa/LimiteDoMapa'
import { ListaLocais } from '../components/ListaLocais'
import { Carregando } from '../components/ui/Carregando'
import { filtrarLocais, raizesComLocais, useCatalogo, useFiltrosNaUrl } from '../lib/catalogo'
import {
  urlGoogleMapsAlgodoal,
  urlGoogleMapsLocal,
  urlGoogleMapsRota,
  urlGoogleStreetView,
} from '../lib/googleMaps'
import './mapa-page-final.css'

// MapLibre é pesado: vai num chunk próprio, e as outras telas não esperam por ele.
const Mapa = lazy(() => import('../components/mapa/Mapa'))
const SEM_CATEGORIAS: never[] = []

function useOnline(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine)

  useEffect(() => {
    const aoFicarOnline = () => setOnline(true)
    const aoFicarOffline = () => setOnline(false)
    window.addEventListener('online', aoFicarOnline)
    window.addEventListener('offline', aoFicarOffline)
    return () => {
      window.removeEventListener('online', aoFicarOnline)
      window.removeEventListener('offline', aoFicarOffline)
    }
  }, [])

  return online
}

function LinkExterno({
  href,
  children,
  desabilitado = false,
  destaque = false,
}: {
  href: string | null
  children: ReactNode
  desabilitado?: boolean
  destaque?: boolean
}) {
  const indisponivel = desabilitado || !href

  if (indisponivel) {
    return (
      <span className="mapa-final__external mapa-final__external--disabled" aria-disabled="true">
        {children}
      </span>
    )
  }

  return (
    <a
      className={`mapa-final__external${destaque ? ' mapa-final__external--primary' : ''}`}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  )
}

export function MapaPage() {
  const catalogo = useCatalogo()
  const filtros = useFiltrosNaUrl()
  const online = useOnline()
  const [selecionado, setSelecionado] = useState<string | null>(null)
  const dados = catalogo.status === 'ok' ? catalogo.dados : null

  const filtrados = useMemo(
    () =>
      dados
        ? filtrarLocais(dados.locais, dados.categorias, filtros.categoria, filtros.busca)
        : [],
    [dados, filtros.categoria, filtros.busca],
  )

  const localAberto = filtrados.find((local) => local.id === selecionado) ?? null
  const googleMapsUrl = localAberto ? urlGoogleMapsLocal(localAberto) : urlGoogleMapsAlgodoal()
  const googleRotaUrl = localAberto ? urlGoogleMapsRota(localAberto) : null
  const streetViewUrl = localAberto ? urlGoogleStreetView(localAberto) : null

  return (
    <section className="page page--mapa mapa-final" aria-labelledby="titulo-mapa">
      <title>Mapa · Algodoal Digital</title>

      <header className="mapa-final__cabecalho">
        <div>
          <p className="mapa-final__eyebrow">Mapa geográfico real</p>
          <h1 id="titulo-mapa" className="so-leitor">
            Mapa
          </h1>
          <h2 className="mapa-final__titulo" aria-hidden="true">
            Explore Algodoal-Maiandeua
          </h2>
          <p className="mapa-final__descricao">
            Ruas, trilhas, praias, mangues, água e pontos locais vêm do mapa real da ilha. O mapa
            principal fica salvo no aparelho para continuar funcionando quando o sinal desaparecer.
          </p>
        </div>

        <div className="mapa-final__status" aria-live="polite">
          <span className={`mapa-final__dot${online ? '' : ' mapa-final__dot--offline'}`} />
          <div>
            <strong>{online ? 'Mapa offline pronto' : 'Você está sem internet'}</strong>
            <span>{online ? 'Google disponível como complemento' : 'MapLibre + PMTiles continuam ativos'}</span>
          </div>
        </div>
      </header>

      {catalogo.status === 'ok' && (
        <div className="mapa-final__filtros">
          <FiltrosCatalogo
            rotuloBusca="Buscar local pelo nome"
            placeholder="Buscar praia, trilha, pousada…"
            categorias={raizesComLocais(catalogo.dados.categorias, catalogo.dados.locais)}
            categoriaAtiva={filtros.categoria}
            busca={filtros.busca}
            aoMudarCategoria={filtros.definirCategoria}
            aoMudarBusca={filtros.definirBusca}
          />
        </div>
      )}

      <div className="mapa-final__modos" aria-label="Opções do mapa">
        <span className="mapa-final__modo mapa-final__modo--ativo">Mapa offline · real</span>
        <LinkExterno href={googleMapsUrl} desabilitado={!online} destaque>
          Google Maps
        </LinkExterno>
        <LinkExterno href={streetViewUrl} desabilitado={!online}>
          Street View
        </LinkExterno>
        <LinkExterno href={googleRotaUrl} desabilitado={!online || !localAberto}>
          Como chegar
        </LinkExterno>
        <span className="mapa-final__modo-ajuda">
          {localAberto
            ? 'As ações Google usam o ponto selecionado.'
            : 'Selecione um marcador para Street View ou rota.'}
        </span>
      </div>

      <div className="mapa-final__stage">
        <div className="mapa-final__canvas">
          <div className="mapa-final__badge-real" aria-hidden="true">
            <span>REAL</span>
            OpenStreetMap · PMTiles
          </div>

          <LimiteDoMapa>
            <Suspense fallback={<div className="mapa mapa--carregando" aria-hidden="true" />}>
              <Mapa
                locais={filtrados}
                categorias={dados?.categorias ?? SEM_CATEGORIAS}
                selecionado={localAberto?.id ?? null}
                aoSelecionar={setSelecionado}
              />
            </Suspense>
          </LimiteDoMapa>

          <div aria-live="polite" className="mapa-final__selecao">
            {localAberto && dados && (
              <CardDoLocal
                local={localAberto}
                categorias={dados.categorias}
                aoFechar={() => setSelecionado(null)}
              />
            )}
          </div>
        </div>

        <aside className="mapa-final__painel" aria-label="Informações do mapa">
          <div className="mapa-final__painel-bloco">
            <span className="mapa-final__painel-kicker">Leitura do mapa</span>
            <h2>O formato é o da ilha real</h2>
            <p>
              O contorno, vias, praias, vegetação e hidrografia não são desenhados manualmente:
              vêm dos vetores do OpenStreetMap empacotados em PMTiles.
            </p>
          </div>

          <dl className="mapa-final__facts">
            <div>
              <dt>Base</dt>
              <dd>OpenStreetMap</dd>
            </div>
            <div>
              <dt>Render</dt>
              <dd>MapLibre GL</dd>
            </div>
            <div>
              <dt>Offline</dt>
              <dd>PMTiles local</dd>
            </div>
            <div>
              <dt>Google</dt>
              <dd>Opcional / online</dd>
            </div>
          </dl>

          <div className="mapa-final__painel-bloco mapa-final__painel-bloco--soft">
            <strong>{filtrados.length} locais visíveis</strong>
            <p>
              Use busca e categorias para reduzir os marcadores. Ao tocar num ponto, os detalhes e
              atalhos externos passam a usar aquele local.
            </p>
          </div>
        </aside>
      </div>

      {catalogo.status === 'carregando' && <Carregando rotulo="Carregando locais…" />}
      {catalogo.status === 'erro' && (
        <FalhaCarga erro={catalogo.erro} aoTentar={catalogo.recarregar} />
      )}

      {dados && (
        <section className="mapa-final__lista" aria-labelledby="titulo-locais-mapa">
          <div className="mapa-final__lista-cabecalho">
            <div>
              <p className="mapa-final__eyebrow">Diretório vinculado ao mapa</p>
              <h2 id="titulo-locais-mapa">Locais encontrados</h2>
            </div>
            <span>{filtrados.length} no filtro atual</span>
          </div>
          <ListaLocais
            locais={filtrados}
            categorias={dados.categorias}
            singular="local"
            plural="locais"
          />
        </section>
      )}
    </section>
  )
}
