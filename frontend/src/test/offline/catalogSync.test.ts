import { describe, expect, it, vi } from 'vitest'
import { CatalogSyncService, type ClienteCatalogo } from '../../lib/sync/syncCatalogo'
import type { CatalogoRepository } from '../../lib/repositories/catalogoRepository'
import type { Categoria, Local } from '../../lib/tipos'

const categorias = [{ id: 'cat-1', name: 'Praias', slug: 'praias' }] as Categoria[]
const locais = [{ id: 'loc-1', name: 'Praia da Princesa', category_id: 'cat-1' }] as Local[]

describe('CatalogSyncService', () => {
  it('só substitui o snapshot depois das duas leituras remotas concluírem', async () => {
    const cliente: ClienteCatalogo = {
      categorias: vi.fn(async () => categorias),
      locais: vi.fn(async () => locais),
    }
    const substituirSnapshot = vi.fn(async () => undefined)
    const repository = { substituirSnapshot } as unknown as CatalogoRepository
    const service = new CatalogSyncService(cliente, repository)

    const resultado = await service.sincronizar()

    expect(substituirSnapshot).toHaveBeenCalledTimes(1)
    expect(substituirSnapshot).toHaveBeenCalledWith(categorias, locais, expect.any(String))
    expect(resultado.categorias).toBe(1)
    expect(resultado.locais).toBe(1)
  })

  it('deduplica chamadas concorrentes', async () => {
    let liberar!: () => void
    const espera = new Promise<void>((resolve) => {
      liberar = resolve
    })
    const cliente: ClienteCatalogo = {
      categorias: vi.fn(async () => {
        await espera
        return categorias
      }),
      locais: vi.fn(async () => {
        await espera
        return locais
      }),
    }
    const repository = {
      substituirSnapshot: vi.fn(async () => undefined),
    } as unknown as CatalogoRepository
    const service = new CatalogSyncService(cliente, repository)

    const primeira = service.sincronizar()
    const segunda = service.sincronizar()
    expect(primeira).toBe(segunda)
    liberar()
    await primeira
    expect(cliente.categorias).toHaveBeenCalledTimes(1)
    expect(cliente.locais).toHaveBeenCalledTimes(1)
  })

  it('não altera o snapshot se uma das leituras falhar', async () => {
    const cliente: ClienteCatalogo = {
      categorias: vi.fn(async () => categorias),
      locais: vi.fn(async () => {
        throw new Error('rede caiu')
      }),
    }
    const substituirSnapshot = vi.fn(async () => undefined)
    const repository = { substituirSnapshot } as unknown as CatalogoRepository
    const service = new CatalogSyncService(cliente, repository)

    await expect(service.sincronizar()).rejects.toThrow('rede caiu')
    expect(substituirSnapshot).not.toHaveBeenCalled()
  })
})
