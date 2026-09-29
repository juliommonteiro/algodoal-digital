import { Link } from 'react-router'
import type { Categoria, Local } from '../lib/tipos'
import { Icone } from './Icone'
import { Rotulo } from './ui/Rotulo'

export interface ItemLocalProps {
  local: Local
  categoria?: Categoria
}

export function ItemLocal({ local, categoria }: ItemLocalProps) {
  const negocio = local.business
  return (
    <li>
      <Link to={`/local/${local.id}`} className="card item-local">
        <Rotulo>{categoria?.name ?? 'Sem categoria'}</Rotulo>
        <h3 className="item-local__nome">{local.name}</h3>
        {local.description && <p className="item-local__descricao">{local.description}</p>}
        {negocio && (negocio.is_partner || negocio.price_range) && (
          <p className="item-local__extras">
            {negocio.is_partner && (
              <span className="selo">
                <Icone nome="selo" tamanho={16} />
                Parceiro
              </span>
            )}
            {negocio.price_range && (
              <span className="mono" aria-label={`Faixa de preço ${negocio.price_range}`}>
                {negocio.price_range}
              </span>
            )}
          </p>
        )}
      </Link>
    </li>
  )
}
