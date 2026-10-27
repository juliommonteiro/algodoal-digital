import { lazy, Suspense, useMemo, useState, type ReactNode } from 'react'
import { FalhaCarga } from '../../FalhaCarga'
import { FiltrosCatalogo } from '../../FiltrosCatalogo'
import { Icone } from '../../Icone'
import { CardDoLocal } from '../../mapa/CardDoLocal'
import { LimiteDoMapa } from '../../mapa/LimiteDoMapa'
import { Carregando } from '../../ui/Carregando'
import { filtrarLocais, raizesComLocais, useCatalogo, useFiltrosNaUrl } from '../../../lib/catalogo'
import {
  urlGoogleMapsAlgodoal,
  urlGoogleMapsLocal,
  urlGoogleMapsRota,
  urlGoogleStreetView,
} from '../../../lib/googleMaps'

function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ')
}

const Mapa = lazy(() => import('../../mapa/Mapa'))
const SEM_CATEGORIAS: never[] = []

function LinkMapa({
  href,
  disabled,
  children,
  primary = false,
}: {
  href: string | null
  disabled: boolean
  children: ReactNode
  primary?: boolean
}) {
  if (disabled || !href) {
    return (
      <span
        aria-disabled="true"
        className="inline-flex min-h-10 cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-3.5 text-xs font-extrabold text-slate-400"
      >
        {children}
      </span>
    )
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border px-3.5 text-xs font-extrabold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-500/20',
        primary
          ? 'border-teal-800 bg-teal-950 text-white hover:bg-teal-900'
          : 'border-slate-200 bg-white text-slate-700 hover:border-teal-200 hover:bg-teal-50 hover:text-teal-900',
      )}
    >
      {children}
    </a>
  )
}

export function MapaRealV2({ offline }: { offline: boolean }) {
  const catalogo = useCatalogo()
  const filtros = useFiltrosNaUrl()
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
  const mapsUrl = localAberto ? urlGoogleMapsLocal(localAberto) : urlGoogleMapsAlgodoal()
  const streetUrl = localAberto ? urlGoogleStreetView(localAberto) : null
  const rotaUrl = localAberto ? urlGoogleMapsRota(localAberto) : null

  return (
    <div className="space-y-4">
      {catalogo.status === 'ok' && (
        <div className="rounded-[1.5rem] border border-slate-200/80 bg-white p-2 shadow-sm">
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

      <div className="flex flex-wrap items-center gap-2 rounded-[1.4rem] border border-slate-200/80 bg-white p-3 shadow-sm">
        <span className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-teal-950 px-3.5 text-xs font-extrabold text-white shadow-md shadow-teal-950/15">
          <Icone nome="mapa" tamanho={16} />
          Mapa real offline
        </span>
        <LinkMapa href={mapsUrl} disabled={offline} primary>
          <Icone nome="bussola" tamanho={16} /> Google Maps
        </LinkMapa>
        <LinkMapa href={streetUrl} disabled={offline || !localAberto}>
          <Icone nome="foto" tamanho={16} /> Street View
        </LinkMapa>
        <LinkMapa href={rotaUrl} disabled={offline || !localAberto}>
          <Icone nome="bussola" tamanho={16} /> Como chegar
        </LinkMapa>
        <span
          className={cn(
            'ml-auto inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-extrabold',
            offline ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-800',
          )}
        >
          <Icone nome={offline ? 'miraBloqueada' : 'mira'} tamanho={14} />
          {offline ? 'Google indisponível offline' : 'Recursos Google online'}
        </span>
      </div>

      <div className="grid min-h-[680px] overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.08)] xl:grid-cols-[minmax(0,1fr)_330px]">
        <div className="relative min-h-[540px] bg-cyan-50">
          <div className="pointer-events-none absolute left-4 top-4 z-20 inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/90 px-3 py-2 text-[11px] font-extrabold text-teal-900 shadow-lg backdrop-blur-md">
            <Icone nome="selo" tamanho={16} className="text-emerald-600" />
            OpenStreetMap · MapLibre · PMTiles
          </div>

          <LimiteDoMapa>
            <Suspense
              fallback={
                <div
                  className="min-h-[540px] animate-pulse bg-gradient-to-br from-cyan-50 to-emerald-50"
                  aria-label="Carregando o mapa"
                  aria-busy="true"
                />
              }
            >
              <Mapa
                locais={filtrados}
                categorias={dados?.categorias ?? SEM_CATEGORIAS}
                selecionado={localAberto?.id ?? null}
                aoSelecionar={setSelecionado}
              />
            </Suspense>
          </LimiteDoMapa>

          <div aria-live="polite">
            {localAberto && dados && (
              <CardDoLocal
                local={localAberto}
                categorias={dados.categorias}
                aoFechar={() => setSelecionado(null)}
              />
            )}
          </div>
        </div>

        <aside className="flex flex-col gap-4 border-t border-slate-200 bg-gradient-to-b from-slate-50 to-white p-5 xl:border-l xl:border-t-0">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-teal-700">
              Cartografia real
            </p>
            <h3 className="mt-1 text-xl font-black tracking-tight text-slate-950">
              A ilha no lugar certo
            </h3>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              O contorno, vias, praias, vegetação, canais e demais detalhes vêm dos vetores reais
              do mapa. Nenhum marcador é posicionado por porcentagem da tela.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {[
              ['Base', 'OpenStreetMap'],
              ['Render', 'MapLibre GL'],
              ['Arquivo', 'PMTiles'],
              ['Internet', 'Não obrigatória'],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200/70">
                <p className="text-[9px] font-extrabold uppercase tracking-[0.15em] text-slate-400">
                  {label}
                </p>
                <p className="mt-1 text-xs font-black text-slate-800">{value}</p>
              </div>
            ))}
          </div>

          <div className="rounded-[1.35rem] border border-teal-100 bg-teal-50/70 p-4">
            <p className="text-sm font-black text-teal-950">
              {filtrados.length} locais no filtro atual
            </p>
            <p className="mt-1.5 text-xs leading-5 text-teal-900/65">
              Toque em um marcador para abrir os detalhes. Street View e rota passam a usar as
              coordenadas desse ponto.
            </p>
          </div>

          {offline && (
            <div className="mt-auto rounded-[1.35rem] border border-amber-200 bg-amber-50 p-4">
              <p className="text-xs font-black text-amber-950">Você continua com o mapa completo.</p>
              <p className="mt-1.5 text-[11px] leading-5 text-amber-900/70">
                Apenas os atalhos do Google ficam indisponíveis até a conexão voltar.
              </p>
            </div>
          )}
        </aside>
      </div>

      {catalogo.status === 'carregando' && <Carregando rotulo="Carregando locais…" />}
      {catalogo.status === 'erro' && (
        <FalhaCarga erro={catalogo.erro} aoTentar={catalogo.recarregar} />
      )}
    </div>
  )
}
