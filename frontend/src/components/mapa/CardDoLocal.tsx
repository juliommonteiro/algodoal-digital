import { Link } from 'react-router'
import { porId } from '../../lib/categorias'
import type { Categoria, Local } from '../../lib/tipos'
import { Icone } from '../Icone'
import { classesBotao } from '../ui/classes'

export interface CardDoLocalProps {
  local: Local
  categorias: Categoria[]
  aoFechar: () => void
}

/** Card resumido do protótipo (02-mapa.png): aparece ao tocar num marcador. */
export function CardDoLocal({ local, categorias, aoFechar }: CardDoLocalProps) {
  const categoria = porId(categorias).get(local.category_id)
  return (
    <section className="card card-do-local" aria-labelledby="card-do-local-nome">
      <div className="card-do-local__foto" aria-hidden="true" />
      <div className="card-do-local__corpo">
        <h2 id="card-do-local-nome" className="card-do-local__nome">
          {local.name}
        </h2>
        <p className="card-do-local__resumo">
          {[categoria?.name, local.description?.split('.')[0]].filter(Boolean).join(' · ')}
        </p>
        <Link to={`/local/${local.id}`} className={classesBotao('primario')}>
          Ver detalhes
        </Link>
      </div>
      <button
        type="button"
        className="card-do-local__fechar"
        aria-label="Fechar"
        onClick={aoFechar}
      >
        <Icone nome="fechar" tamanho={20} />
      </button>
    </section>
  )
}
