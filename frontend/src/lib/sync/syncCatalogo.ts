import { api } from '../cliente'
import { logEstruturado } from '../observabilidade'
import { catalogoRepository, type CatalogoRepository } from '../repositories/catalogoRepository'
import type { ClienteApi } from '../tipos'

export type ClienteCatalogo = Pick<ClienteApi, 'catalogo'>

export interface ResultadoSyncCatalogo {
  /** true: veio o catálogo inteiro; false: só o que mudou desde o último pull. */
  completo: boolean
  categorias: number
  /** Locais que vieram nesta resposta (todos, se completo). */
  locais: number
  removidos: number
  sincronizadoEm: string
  duracaoMs: number
}

export class CatalogSyncService {
  private emAndamento: Promise<ResultadoSyncCatalogo> | null = null
  private readonly cliente: ClienteCatalogo
  private readonly repository: CatalogoRepository

  constructor(cliente: ClienteCatalogo = api, repository: CatalogoRepository = catalogoRepository) {
    this.cliente = cliente
    this.repository = repository
  }

  sincronizar(): Promise<ResultadoSyncCatalogo> {
    if (this.emAndamento) return this.emAndamento
    const execucao = this.executar().finally(() => {
      if (this.emAndamento === execucao) this.emAndamento = null
    })
    this.emAndamento = execucao
    return execucao
  }

  /**
   * Pull do catálogo (#28, GET /sync/catalog). Com cursor e conteúdo no aparelho, pede só o que
   * mudou; sem eles (primeira vez, banco limpo), pede o inteiro e troca tudo.
   */
  private async executar(): Promise<ResultadoSyncCatalogo> {
    const inicio = performance.now()
    const [cursor, temConteudo] = await Promise.all([
      this.repository.cursor(),
      this.repository.temConteudo(),
    ])
    const resposta = await this.cliente.catalogo(cursor && temConteudo ? cursor : undefined)
    const sincronizadoEm = new Date().toISOString()
    if (resposta.full) {
      await this.repository.substituirSnapshot(
        resposta.categories,
        resposta.places,
        sincronizadoEm,
        resposta.server_time,
      )
    } else {
      await this.repository.aplicarMudancas(
        resposta.categories,
        resposta.places,
        resposta.removed_place_ids,
        sincronizadoEm,
        resposta.server_time,
      )
    }
    const resultado = {
      completo: resposta.full,
      categorias: resposta.categories.length,
      locais: resposta.places.length,
      removidos: resposta.removed_place_ids.length,
      sincronizadoEm,
      duracaoMs: Math.round(performance.now() - inicio),
    }
    logEstruturado('INFO', 'catalog_sync_success', resultado)
    return resultado
  }
}

export const catalogSync = new CatalogSyncService()