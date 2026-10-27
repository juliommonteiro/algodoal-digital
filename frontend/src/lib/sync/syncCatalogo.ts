import { api } from '../cliente'
import { logEstruturado } from '../observabilidade'
import { catalogoRepository, type CatalogoRepository } from '../repositories/catalogoRepository'
import type { ClienteApi } from '../tipos'

export type ClienteCatalogo = Pick<ClienteApi, 'categorias' | 'locais'>

export interface ResultadoSyncCatalogo {
  categorias: number
  locais: number
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

  private async executar(): Promise<ResultadoSyncCatalogo> {
    const inicio = performance.now()
    const [categorias, locais] = await Promise.all([this.cliente.categorias(), this.cliente.locais()])
    const sincronizadoEm = new Date().toISOString()
    await this.repository.substituirSnapshot(categorias, locais, sincronizadoEm)
    const resultado = {
      categorias: categorias.length,
      locais: locais.length,
      sincronizadoEm,
      duracaoMs: Math.round(performance.now() - inicio),
    }
    logEstruturado('INFO', 'catalog_sync_success', resultado)
    return resultado
  }
}

export const catalogSync = new CatalogSyncService()