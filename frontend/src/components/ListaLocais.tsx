import { porId } from '../lib/categorias'
import type { Categoria, Local } from '../lib/tipos'
import { Icone } from './Icone'
import { ItemLocal } from './ItemLocal'
import { EstadoVazio } from './ui/EstadoVazio'
import { Rotulo } from './ui/Rotulo'

export interface ListaLocaisProps {
  locais: Local[]
  categorias: Categoria[]
  /** Ex.: "local" → "1 local" / "12 locais". */
  singular: string
  plural: string
}

export function ListaLocais({ locais, categorias, singular, plural }: ListaLocaisProps) {
  const categoriaPorId = porId(categorias)

  if (locais.length === 0) {
    return (
      <EstadoVazio
        icone={<Icone nome="busca" />}
        titulo="Nada encontrado"
        frase="Tente outra categoria ou procure por outro nome."
      />
    )
  }

  return (
    <>
      <Rotulo as="h2" className="lista__contagem" aria-live="polite">
        {locais.length} {locais.length === 1 ? singular : plural}
      </Rotulo>
      <ul className="lista">
        {locais.map((local) => (
          <ItemLocal key={local.id} local={local} categoria={categoriaPorId.get(local.category_id)} />
        ))}
      </ul>
    </>
  )
}
