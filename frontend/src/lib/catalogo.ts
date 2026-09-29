import { useSearchParams } from 'react-router'
import { categoriasRaiz, idsDaArvore } from './categorias'
import { api } from './cliente'
import { normalizar } from './formatos'
import type { Categoria, Local } from './tipos'
import { useCarregar } from './useCarregar'

export interface Catalogo {
  categorias: Categoria[]
  locais: Local[]
}

/**
 * Categorias + locais. Por enquanto vem direto do cliente de API; na S8 passa a ler do
 * IndexedDB (a tela lê do banco local, a API alimenta o banco em segundo plano).
 */
export function useCatalogo() {
  return useCarregar<Catalogo>('catalogo', async () => {
    const [categorias, locais] = await Promise.all([api.categorias(), api.locais()])
    return { categorias, locais }
  })
}

/** Categorias de primeiro nível que têm pelo menos um dos locais — chip vazio é beco sem saída. */
export function raizesComLocais(categorias: Categoria[], locais: Local[]): Categoria[] {
  return categoriasRaiz(categorias).filter((raiz) => {
    const ids = idsDaArvore(categorias, raiz.id)
    return locais.some((l) => ids.has(l.category_id))
  })
}

export function filtrarLocais(
  locais: Local[],
  categorias: Categoria[],
  slugRaiz: string,
  busca: string,
): Local[] {
  let resultado = locais
  const raiz = slugRaiz ? categorias.find((c) => c.slug === slugRaiz) : undefined
  if (raiz) {
    const ids = idsDaArvore(categorias, raiz.id)
    resultado = resultado.filter((l) => ids.has(l.category_id))
  }
  const termo = normalizar(busca)
  if (termo) resultado = resultado.filter((l) => normalizar(l.name).includes(termo))
  return resultado
}

/**
 * Filtros guardados na URL (?categoria=&q=): voltar do detalhe mantém o que estava filtrado,
 * e o link pode ser compartilhado.
 */
export function useFiltrosNaUrl() {
  const [params, setParams] = useSearchParams()

  function atualizar(chave: 'categoria' | 'q', valor: string) {
    setParams(
      (atuais) => {
        const novos = new URLSearchParams(atuais)
        if (valor) novos.set(chave, valor)
        else novos.delete(chave)
        return novos
      },
      { replace: true },
    )
  }

  return {
    categoria: params.get('categoria') ?? '',
    busca: params.get('q') ?? '',
    definirCategoria: (slug: string) => atualizar('categoria', slug),
    definirBusca: (texto: string) => atualizar('q', texto),
  }
}
