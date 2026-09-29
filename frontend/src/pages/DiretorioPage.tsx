import { FalhaCarga } from '../components/FalhaCarga'
import { FiltrosCatalogo } from '../components/FiltrosCatalogo'
import { ListaLocais } from '../components/ListaLocais'
import { Carregando } from '../components/ui/Carregando'
import { filtrarLocais, raizesComLocais, useCatalogo, useFiltrosNaUrl } from '../lib/catalogo'

/**
 * Diretório = todos os locais publicados, em lista: praias, trilhas e pontos de coleta junto
 * com os negócios (protótipo, docs/prototipo/04-diretorio.png). O que o separa do Mapa é o
 * formato, lista contra mapa, não o conteúdo.
 */
export function DiretorioPage() {
  const catalogo = useCatalogo()
  const filtros = useFiltrosNaUrl()

  return (
    <section className="page" aria-labelledby="titulo-diretorio">
      <title>Diretório · Algodoal Digital</title>
      <h1 id="titulo-diretorio">Diretório</h1>
      <p className="page__intro">
        Praias, trilhas, restaurantes, pousadas e serviços da ilha, com contato pelo WhatsApp.
      </p>

      {catalogo.status === 'carregando' && <Carregando rotulo="Carregando locais…" />}
      {catalogo.status === 'erro' && (
        <FalhaCarga erro={catalogo.erro} aoTentar={catalogo.recarregar} />
      )}
      {catalogo.status === 'ok' && (
        <>
          <FiltrosCatalogo
            rotuloBusca="Buscar local pelo nome"
            placeholder="Buscar pelo nome…"
            categorias={raizesComLocais(catalogo.dados.categorias, catalogo.dados.locais)}
            categoriaAtiva={filtros.categoria}
            busca={filtros.busca}
            aoMudarCategoria={filtros.definirCategoria}
            aoMudarBusca={filtros.definirBusca}
          />
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
        </>
      )}
    </section>
  )
}
