import type { Categoria } from './tipos'

/** Categorias de primeiro nível (Turismo, Alimentação…), na ordem definida. */
export function categoriasRaiz(categorias: Categoria[]): Categoria[] {
  return categorias
    .filter((c) => c.parent_id === null)
    .sort((a, b) => a.sort_order - b.sort_order)
}

/** A própria categoria e todas as descendentes. */
export function idsDaArvore(categorias: Categoria[], idRaiz: string): Set<string> {
  const ids = new Set([idRaiz])
  let cresceu = true
  while (cresceu) {
    cresceu = false
    for (const c of categorias) {
      if (c.parent_id && ids.has(c.parent_id) && !ids.has(c.id)) {
        ids.add(c.id)
        cresceu = true
      }
    }
  }
  return ids
}

export function porId(categorias: Categoria[]): Map<string, Categoria> {
  return new Map(categorias.map((c) => [c.id, c]))
}

/** Categoria de primeiro nível de onde `id` descende (a própria, se já for raiz). */
export function raizDaCategoria(
  categoriasPorId: Map<string, Categoria>,
  id: string,
): Categoria | undefined {
  let atual = categoriasPorId.get(id)
  for (let passos = 0; atual?.parent_id && passos < 20; passos++) {
    atual = categoriasPorId.get(atual.parent_id)
  }
  return atual
}
