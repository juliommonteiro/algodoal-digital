import { categoriasRaiz } from '../lib/categorias'
import type { Categoria, StatusAdmin } from '../lib/tipos'

export const ROTULO_STATUS: Record<StatusAdmin, string> = {
  publicado: 'Publicado',
  rascunho: 'Rascunho',
  removido: 'Removido',
}

/**
 * Categorias para um <select>, em árvore (cada raiz seguida das filhas). A filha leva o nome da
 * mãe ("Alimentação › Restaurantes"): o <option> não aceita recuo, e assim o valor escolhido
 * continua claro quando o select está fechado.
 */
export function opcoesDeCategoria(
  categorias: Categoria[],
): { categoria: Categoria; rotulo: string }[] {
  const resultado: { categoria: Categoria; rotulo: string }[] = []
  const visitar = (categoria: Categoria, caminho: string) => {
    const rotulo = caminho ? `${caminho} › ${categoria.name}` : categoria.name
    resultado.push({ categoria, rotulo })
    categorias
      .filter((c) => c.parent_id === categoria.id)
      .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'pt-BR'))
      .forEach((filha) => visitar(filha, rotulo))
  }
  categoriasRaiz(categorias).forEach((raiz) => visitar(raiz, ''))
  return resultado
}
