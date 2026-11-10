import type { Categoria, Local } from '../tipos'
import { db, type AlgodoalDatabase, type CategoriaLocal, type LocalLocal } from '../db'

const CHAVE_ULTIMA_SYNC = 'catalogo:last_sync'
// server_time da última resposta de /sync/catalog: volta como `since` (#28). É a hora do
// servidor; a de CHAVE_ULTIMA_SYNC é a do celular, só para mostrar na tela.
const CHAVE_CURSOR = 'catalogo:server_time'

function porNome(a: LocalLocal, b: LocalLocal): number {
  return a.name.localeCompare(b.name, 'pt-BR')
}

function paraLinha(data: Local, ordem: number): LocalLocal {
  return { id: data.id, category_id: data.category_id, name: data.name, ordem, data }
}

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
    cursor: string | null = null,
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
        await this.guardarMetadados(sincronizadoEm, cursor)
      },
    )
  }

  /**
   * Pull incremental (#28): troca as categorias, apaga os que saíram do público e grava por
   * cima os que mudaram. Tudo numa transação: o mapa nunca vê o catálogo pela metade.
   */
  async aplicarMudancas(
    categorias: Categoria[],
    alterados: Local[],
    removidos: string[],
    sincronizadoEm: string,
    cursor: string,
  ): Promise<void> {
    validarIdsUnicos(categorias, 'Categoria')
    validarIdsUnicos(alterados, 'Local')
    await this.database.transaction(
      'rw',
      this.database.categorias,
      this.database.locais,
      this.database.metadadosSync,
      async () => {
        // Sync sem mudança (o caso comum, a cada volta à aba) não escreve em categorias nem em
        // locais: escrever dispararia o liveQuery e redesenharia o mapa à toa.
        const atuais = (await this.database.categorias.orderBy('ordem').toArray()).map((c) => c.data)
        if (JSON.stringify(atuais) !== JSON.stringify(categorias)) {
          await this.database.categorias.clear()
          if (categorias.length) {
            await this.database.categorias.bulkPut(
              categorias.map((data, ordem) => ({ id: data.id, ordem, data })),
            )
          }
        }
        if (removidos.length || alterados.length) {
          if (removidos.length) await this.database.locais.bulkDelete(removidos)
          if (alterados.length) {
            await this.database.locais.bulkPut(alterados.map((l) => paraLinha(l, 0)))
          }
          // A lista do mapa sai por `ordem`: renumera por nome, como a API manda o inteiro.
          const todos = (await this.database.locais.toArray()).sort(porNome)
          const mudaram = todos
            .map((linha, ordem) => ({ ...linha, ordem }))
            .filter((linha, i) => linha.ordem !== todos[i].ordem || alterados.some((l) => l.id === linha.id))
          if (mudaram.length) await this.database.locais.bulkPut(mudaram)
        }
        await this.guardarMetadados(sincronizadoEm, cursor)
      },
    )
  }

  private async guardarMetadados(sincronizadoEm: string, cursor: string | null): Promise<void> {
    await this.database.metadadosSync.put({
      key: CHAVE_ULTIMA_SYNC,
      value: sincronizadoEm,
      updated_at: sincronizadoEm,
    })
    if (cursor) {
      await this.database.metadadosSync.put({
        key: CHAVE_CURSOR,
        value: cursor,
        updated_at: sincronizadoEm,
      })
    }
  }

  /** `since` para o próximo pull; null = ainda não houve sync completo neste aparelho. */
  async cursor(): Promise<string | null> {
    return (await this.database.metadadosSync.get(CHAVE_CURSOR))?.value ?? null
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