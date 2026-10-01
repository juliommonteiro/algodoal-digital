import { lazy, Suspense, useMemo, useState } from 'react'
import { FalhaCarga } from '../components/FalhaCarga'
import { FiltrosCatalogo } from '../components/FiltrosCatalogo'
import { CardDoLocal } from '../components/mapa/CardDoLocal'
import { LimiteDoMapa } from '../components/mapa/LimiteDoMapa'
import { ListaLocais } from '../components/ListaLocais'
import { Carregando } from '../components/ui/Carregando'
import { filtrarLocais, raizesComLocais, useCatalogo, useFiltrosNaUrl } from '../lib/catalogo'

// MapLibre é pesado: vai num chunk próprio, e as outras telas não esperam por ele.
const Mapa = lazy(() => import('../components/mapa/Mapa'))
const SEM_CATEGORIAS: never[] = []

export function MapaPage() {
  const catalogo = useCatalogo()
  const filtros = useFiltrosNaUrl()
  const [selecionado, setSelecionado] = useState<string | null>(null)

  const dados = catalogo.status === 'ok' ? catalogo.dados : null
  // Memorizado: o mapa refaz os marcadores quando esta lista muda, e não deve refazer a cada
  // render (ex.: ao abrir o card). Os chips e a busca filtram aqui, sem chamar a API de novo.
  const filtrados = useMemo(
    () =>
      dados
        ? filtrarLocais(dados.locais, dados.categorias, filtros.categoria, filtros.busca)
        : [],
    [dados, filtros.categoria, filtros.busca],
  )
  // Se o filtro tirou o local selecionado do mapa, o card fecha junto.
  const localAberto = filtrados.find((l) => l.id === selecionado) ?? null

  return (
    <section className="page page--mapa" aria-labelledby="titulo-mapa">
      <title>Mapa · Algodoal Digital</title>
      <h1 id="titulo-mapa" className="so-leitor">
        Mapa
      </h1>

      {catalogo.status === 'ok' && (
        <FiltrosCatalogo
          rotuloBusca="Buscar local pelo nome"
          placeholder="Buscar praia, trilha, pousada…"
          categorias={raizesComLocais(catalogo.dados.categorias, catalogo.dados.locais)}
          categoriaAtiva={filtros.categoria}
          busca={filtros.busca}
          aoMudarCategoria={filtros.definirCategoria}
          aoMudarBusca={filtros.definirBusca}
        />
      )}

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

      {/* O leitor de tela anuncia o local escolhido no mapa. */}
      <div aria-live="polite">
        {localAberto && dados && (
          <CardDoLocal
            local={localAberto}
            categorias={dados.categorias}
            aoFechar={() => setSelecionado(null)}
          />
        )}
      </div>

      {catalogo.status === 'carregando' && <Carregando rotulo="Carregando locais…" />}
      {catalogo.status === 'erro' && (
        <FalhaCarga erro={catalogo.erro} aoTentar={catalogo.recarregar} />
      )}
      {dados && (
        <ListaLocais
          locais={filtrados}
          categorias={dados.categorias}
          singular="local"
          plural="locais"
        />
      )}
    </section>
  )
}
