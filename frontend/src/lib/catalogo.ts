import { liveQuery } from 'dexie'
import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { ErroApi } from './api'
import { categoriasRaiz, idsDaArvore } from './categorias'
import { api } from './cliente'
import { normalizar } from './formatos'
import { catalogoRepository } from './repositories/catalogoRepository'
import { catalogSync } from './sync/syncCatalogo'
import type { Categoria, Local } from './tipos'

export interface Catalogo {
  categorias: Categoria[]
  locais: Local[]
}

type EstadoCatalogo =
  | { status: 'carregando' }
  | { status: 'ok'; dados: Catalogo }
  | { status: 'erro'; erro: ErroApi }

function temConteudo(catalogo: Catalogo): boolean {
  return catalogo.categorias.length > 0 || catalogo.locais.length > 0
}

function erroDeCarga(erro: unknown): ErroApi {
  if (erro instanceof ErroApi) return erro
  return new ErroApi(500, 'Não foi possível acessar os dados locais do aplicativo.')
}

export function useCatalogo() {
  const [estado, setEstado] = useState<EstadoCatalogo>({ status: 'carregando' })
  const [versao, setVersao] = useState(0)
  const recarregar = useCallback(() => {
    setEstado({ status: 'carregando' })
    setVersao((atual) => atual + 1)
  }, [])

  useEffect(() => {
    let ativo = true
    const assinatura = liveQuery(() => catalogoRepository.obterSnapshot()).subscribe({
      next: (dados) => {
        if (ativo && temConteudo(dados)) setEstado({ status: 'ok', dados })
      },
      error: (erro) => {
        if (ativo) setEstado({ status: 'erro', erro: erroDeCarga(erro) })
      },
    })

    void catalogSync
      .sincronizar()
      .then(async () => {
        if (!ativo) return
        const dados = await catalogoRepository.obterSnapshot()
        if (ativo) setEstado({ status: 'ok', dados })
      })
      .catch(async (erro) => {
        if (!ativo) return
        try {
          const dados = await catalogoRepository.obterSnapshot()
          if (temConteudo(dados)) {
            setEstado({ status: 'ok', dados })
            return
          }
        } catch {
          // O erro original da sincronização é mais útil para a tela.
        }
        setEstado({ status: 'erro', erro: erroDeCarga(erro) })
      })

    return () => {
      ativo = false
      assinatura.unsubscribe()
    }
  }, [versao])

  return { ...estado, recarregar }
}

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

export async function buscarLocal(id: string): Promise<Local> {
  const local = await catalogoRepository.obterLocal(id)
  if (local) return local
  try {
    const remoto = await api.local(id)
    await catalogoRepository.salvarLocal(remoto)
    return remoto
  } catch (erro) {
    const apareceuEnquantoBuscava = await catalogoRepository.obterLocal(id)
    if (apareceuEnquantoBuscava) return apareceuEnquantoBuscava
    if (erro instanceof ErroApi && erro.semRede) {
      const daLista = (await api.locais()).find((item) => item.id === id)
      if (daLista) {
        await catalogoRepository.salvarLocal(daLista)
        return daLista
      }
    }
    throw erro
  }
}
