import { FalhaCarga } from '../components/FalhaCarga'
import { FiltrosCatalogo } from '../components/FiltrosCatalogo'
import { ListaLocais } from '../components/ListaLocais'
import { Carregando } from '../components/ui/Carregando'
import { filtrarLocais, raizesComLocais, useCatalogo, useFiltrosNaUrl } from '../lib/catalogo'

/** Diretório = locais com dados comerciais (restaurantes, pousadas, artesãos, guias…). */
export function DiretorioPage() {
  const catalogo = useCatalogo()
  const filtros = useFiltrosNaUrl()

  const estabelecimentos =
    catalogo.status === 'ok' ? catalogo.dados.locais.filter((l) => l.business !== null) : []

  return (
    <section className="page" aria-labelledby="titulo-diretorio">
      <title>Diretório · Algodoal Digital</title>
      <h1 id="titulo-diretorio">Diretório</h1>
      <p className="page__intro">
        Restaurantes, pousadas, artesãos e guias, com contato pelo WhatsApp.
      </p>

      {catalogo.status === 'carregando' && <Carregando rotulo="Carregando estabelecimentos…" />}
      {catalogo.status === 'erro' && (
        <FalhaCarga erro={catalogo.erro} aoTentar={catalogo.recarregar} />
      )}
      {catalogo.status === 'ok' && (
        <>
          <FiltrosCatalogo
            rotuloBusca="Buscar estabelecimento pelo nome"
            placeholder="Buscar pelo nome…"
            categorias={raizesComLocais(catalogo.dados.categorias, estabelecimentos)}
            categoriaAtiva={filtros.categoria}
            busca={filtros.busca}
            aoMudarCategoria={filtros.definirCategoria}
            aoMudarBusca={filtros.definirBusca}
          />
          <ListaLocais
            locais={filtrarLocais(
              estabelecimentos,
              catalogo.dados.categorias,
              filtros.categoria,
              filtros.busca,
            )}
            categorias={catalogo.dados.categorias}
            singular="estabelecimento"
            plural="estabelecimentos"
          />
        </>
      )}
    </section>
  )
}
