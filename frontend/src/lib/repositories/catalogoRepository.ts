import type { Categoria, Local } from '../tipos'
import { db, type AlgodoalDatabase, type CategoriaLocal, type LocalLocal } from '../db'

const CHAVE_ULTIMA_SYNC = 'catalogo:last_sync'

export interface SnapshotCatalogo {
  categorias: Categoria[]
  locais: Local[]
}

function validarIdsUnicos<T extends { id: string }>(itens: T[], entidade: string): void {
  const vistos = new Set<string>()
  for (const item of itens) {
    if (!item.id || typeof item.id !== 'string') throw new Error(`${entidade} sem id válido no snapshot.`)
    if (vistos.has(item.id)) throw new Error(`${entidade} duplicado no snapshot: ${item.id}`)
    vistos.add(item.id)
  }
}

export class CatalogoRepository {
  private readonly database: AlgodoalDatabase

  constructor(database: AlgodoalDatabase = db) {
    this.database = database
  }

  async obterSnapshot(): Promise<SnapshotCatalogo> {
    const [categorias, locais] = await Promise.all([
      this.database.categorias.orderBy('ordem').toArray(),
      this.database.locais.orderBy('ordem').toArray(),
    ])
    return {
      categorias: categorias.map((item) => item.data),
      locais: locais.map((item) => item.data),
    }
  }

  async listarCategorias(): Promise<Categoria[]> {
    return (await this.database.categorias.orderBy('ordem').toArray()).map((item) => item.data)
  }

  async listarLocais(): Promise<Local[]> {
    return (await this.database.locais.orderBy('ordem').toArray()).map((item) => item.data)
  }

  async obterLocal(id: string): Promise<Local | undefined> {
    return (await this.database.locais.get(id))?.data
  }

  async substituirSnapshot(
    categorias: Categoria[],
    locais: Local[],
    sincronizadoEm = new Date().toISOString(),
  ): Promise<void> {
    validarIdsUnicos(categorias, 'Categoria')
    validarIdsUnicos(locais, 'Local')
    const categoriasLocais: CategoriaLocal[] = categorias.map((data, ordem) => ({
      id: data.id,
      ordem,
      data,
    }))
    const locaisLocais: LocalLocal[] = locais.map((data, ordem) => ({
      id: data.id,
      category_id: data.category_id,
      name: data.name,
      ordem,
      data,
    }))

    await this.database.transaction(
      'rw',
      this.database.categorias,
      this.database.locais,
      this.database.metadadosSync,
      async () => {
        await this.database.categorias.clear()
        if (categoriasLocais.length) await this.database.categorias.bulkPut(categoriasLocais)
        await this.database.locais.clear()
        if (locaisLocais.length) await this.database.locais.bulkPut(locaisLocais)
        await this.database.metadadosSync.put({
          key: CHAVE_ULTIMA_SYNC,
          value: sincronizadoEm,
          updated_at: sincronizadoEm,
        })
      },
    )
  }

  async salvarLocal(local: Local): Promise<void> {
    const existente = await this.database.locais.get(local.id)
    const ordem = existente?.ordem ?? (await this.database.locais.count())
    await this.database.locais.put({
      id: local.id,
      category_id: local.category_id,
      name: local.name,
      ordem,
      data: local,
    })
  }

  async ultimaSincronizacao(): Promise<string | null> {
    return (await this.database.metadadosSync.get(CHAVE_ULTIMA_SYNC))?.value ?? null
  }

  async temConteudo(): Promise<boolean> {
    const [categorias, locais] = await Promise.all([
      this.database.categorias.count(),
      this.database.locais.count(),
    ])
    return categorias > 0 || locais > 0
  }
}

export const catalogoRepository = new CatalogoRepository()