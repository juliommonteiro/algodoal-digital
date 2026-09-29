import { FalhaCarga } from '../components/FalhaCarga'
import { FiltrosCatalogo } from '../components/FiltrosCatalogo'
import { ListaLocais } from '../components/ListaLocais'
import { Carregando } from '../components/ui/Carregando'
import { filtrarLocais, raizesComLocais, useCatalogo, useFiltrosNaUrl } from '../lib/catalogo'

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

      <div className="mapa-reservado" role="img" aria-label="Espaço do mapa da ilha, que chega na S6">
        {/* S6: MapLibre + PMTiles */}
        <span className="rotulo">Mapa da ilha — chega na S6</span>
      </div>

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
