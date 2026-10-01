import { lazy, Suspense } from 'react'
import { FalhaCarga } from '../components/FalhaCarga'
import { FiltrosCatalogo } from '../components/FiltrosCatalogo'
import { LimiteDoMapa } from '../components/mapa/LimiteDoMapa'
import { ListaLocais } from '../components/ListaLocais'
import { Carregando } from '../components/ui/Carregando'
import { filtrarLocais, raizesComLocais, useCatalogo, useFiltrosNaUrl } from '../lib/catalogo'

// MapLibre é pesado: vai num chunk próprio, e as outras telas não esperam por ele.
const Mapa = lazy(() => import('../components/mapa/Mapa'))

export function MapaPage() {
  const catalogo = useCatalogo()
  const filtros = useFiltrosNaUrl()

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
          <Mapa />
        </Suspense>
      </LimiteDoMapa>

      {catalogo.status === 'carregando' && <Carregando rotulo="Carregando locais…" />}
      {catalogo.status === 'erro' && (
        <FalhaCarga erro={catalogo.erro} aoTentar={catalogo.recarregar} />
      )}
      {catalogo.status === 'ok' && (
        <ListaLocais
          locais={filtrarLocais(
            catalogo.dados.locais,
            catalogo.dados.categorias,
            filtros.categoria,
            filtros.busca,
          )}
          categorias={catalogo.dados.categorias}
          singular="local"
          plural="locais"
        />
      )}
    </section>
  )
}
