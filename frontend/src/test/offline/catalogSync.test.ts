import { describe, expect, it, vi } from 'vitest'
import { db } from '../../lib/db'
import { CatalogoRepository } from '../../lib/repositories/catalogoRepository'
import { CatalogSyncService, type ClienteCatalogo } from '../../lib/sync/syncCatalogo'
import type { CatalogoSync, Categoria, Local } from '../../lib/tipos'

const categorias = [{ id: 'cat-1', name: 'Praias', slug: 'praias' }] as Categoria[]
const local = (id: string, name: string) => ({ id, name, category_id: 'cat-1' }) as Local

function resposta(mudancas: Partial<CatalogoSync>): CatalogoSync {
  return {
    server_time: '2026-11-10T12:00:00Z',
    full: true,
    categories: categorias,
    places: [],
    removed_place_ids: [],
    ...mudancas,
  }
}

describe('CatalogSyncService', () => {
  it('na primeira vez pede o catálogo inteiro e guarda o server_time como cursor', async () => {
    const repository = new CatalogoRepository(db)
    const catalogo = vi.fn(async () =>
      resposta({ places: [local('b', 'Praia B'), local('a', 'Praia A')] }),
    )
    const service = new CatalogSyncService({ catalogo }, repository)

    const resultado = await service.sincronizar()

    expect(catalogo).toHaveBeenCalledWith(undefined)
    expect(resultado).toMatchObject({ completo: true, locais: 2, removidos: 0 })
    expect(await repository.cursor()).toBe('2026-11-10T12:00:00Z')
    expect((await repository.listarLocais()).map((l) => l.name)).toEqual(['Praia B', 'Praia A'])
  })

  it('depois pede só o que mudou, aplica por cima, apaga os que saíram e mantém a ordem por nome', async () => {
    const repository = new CatalogoRepository(db)
    await repository.substituirSnapshot(
      categorias,
      [local('a', 'Praia A'), local('c', 'Praia C'), local('x', 'Removida')],
      '2026-11-10T11:00:00Z',
      '2026-11-10T11:00:00Z',
    )
    const catalogo = vi.fn(async () =>
      resposta({
        server_time: '2026-11-10T12:00:00Z',
        full: false,
        places: [local('b', 'Praia B'), local('c', 'Praia C renomeada')],
        removed_place_ids: ['x'],
      }),
    )
    const service = new CatalogSyncService({ catalogo }, repository)

    const resultado = await service.sincronizar()

    expect(catalogo).toHaveBeenCalledWith('2026-11-10T11:00:00Z')
    expect(resultado).toMatchObject({ completo: false, locais: 2, removidos: 1 })
    expect((await repository.listarLocais()).map((l) => l.name)).toEqual([
      'Praia A',
      'Praia B',
      'Praia C renomeada',
    ])
    expect(await repository.cursor()).toBe('2026-11-10T12:00:00Z')
  })

  it('com cursor mas sem conteúdo (aparelho limpo) pede o inteiro de novo', async () => {
    const repository = new CatalogoRepository(db)
    await repository.substituirSnapshot(categorias, [], '2026-11-10T11:00:00Z', 'cursor-velho')
    await db.categorias.clear()
    const catalogo = vi.fn(async () => resposta({ places: [local('a', 'Praia A')] }))

    await new CatalogSyncService({ catalogo }, repository).sincronizar()

    expect(catalogo).toHaveBeenCalledWith(undefined)
  })

  it('deduplica chamadas concorrentes', async () => {
    let liberar!: () => void
    const espera = new Promise<void>((resolve) => {
      liberar = resolve
    })
    const cliente: ClienteCatalogo = {
      catalogo: vi.fn(async () => {
        await espera
        return resposta({})
      }),
    }
    const service = new CatalogSyncService(cliente, new CatalogoRepository(db))

    const primeira = service.sincronizar()
    const segunda = service.sincronizar()
    expect(primeira).toBe(segunda)
    liberar()
    await primeira
    expect(cliente.catalogo).toHaveBeenCalledTimes(1)
  })

  it('não altera o aparelho se a rede falhar', async () => {
    const repository = new CatalogoRepository(db)
    await repository.substituirSnapshot(categorias, [local('a', 'Praia A')], 'x', 'cursor')
    const service = new CatalogSyncService(
      {
        catalogo: vi.fn(async () => {
          throw new Error('rede caiu')
        }),
      },
      repository,
    )

    await expect(service.sincronizar()).rejects.toThrow('rede caiu')
    expect((await repository.listarLocais()).map((l) => l.name)).toEqual(['Praia A'])
    expect(await repository.cursor()).toBe('cursor')
  })
})
