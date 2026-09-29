import { useId } from 'react'
import type { Categoria } from '../lib/tipos'
import { Icone } from './Icone'
import { Chip, GrupoChips } from './ui/Chip'

export interface FiltrosCatalogoProps {
  rotuloBusca: string
  placeholder: string
  categorias: Categoria[]
  categoriaAtiva: string
  busca: string
  aoMudarCategoria: (slug: string) => void
  aoMudarBusca: (texto: string) => void
}

/** Busca por nome + faixa de chips de categoria. Usado no Mapa e no Diretório. */
export function FiltrosCatalogo({
  rotuloBusca,
  placeholder,
  categorias,
  categoriaAtiva,
  busca,
  aoMudarCategoria,
  aoMudarBusca,
}: FiltrosCatalogoProps) {
  const idBusca = useId()
  // Categoria da URL que não está entre as opções conta como "Todas".
  const ativa = categorias.some((c) => c.slug === categoriaAtiva) ? categoriaAtiva : ''

  return (
    <div className="filtros">
      <form role="search" className="busca" onSubmit={(ev) => ev.preventDefault()}>
        <label htmlFor={idBusca} className="so-leitor">
          {rotuloBusca}
        </label>
        <Icone nome="busca" tamanho={20} className="busca__icone" />
        <input
          id={idBusca}
          type="search"
          className="busca__input"
          placeholder={placeholder}
          value={busca}
          onChange={(ev) => aoMudarBusca(ev.target.value)}
          autoComplete="off"
          enterKeyHint="search"
        />
      </form>
      <GrupoChips rotulo="Filtrar por categoria">
        <Chip ativo={ativa === ''} aoSelecionar={() => aoMudarCategoria('')}>
          Todas
        </Chip>
        {categorias.map((c) => (
          <Chip key={c.id} ativo={ativa === c.slug} aoSelecionar={() => aoMudarCategoria(c.slug)}>
            {c.name}
          </Chip>
        ))}
      </GrupoChips>
    </div>
  )
}
