import { describe, expect, it, vi } from 'vitest'
import type { EventoOutbox } from '../../lib/db'
import type { OutboxRepository } from '../../lib/repositories/outboxRepository'
import { OutboxSyncService, type TransporteOutbox } from '../../lib/sync/syncOutbox'

function evento(id: string): EventoOutbox {
  return {
    client_uuid: id,
    tipo: 'checkin',
    payload: { place_id: 'x' },
    occurred_at: '2026-10-21T20:00:00.000Z',
    created_at: '2026-10-21T20:00:00.000Z',
    user_id: 'u1',
    status: 'pending',
    attempts: 0,
    next_attempt_at: null,
    last_error: null,
  }
}

describe('OutboxSyncService', () => {
  it('remove aceitos, mantém rejeitados para auditoria e reagenda transitórios', async () => {
    const eventos = [evento('a'), evento('b'), evento('c')]
    const repository = {
      listarProntos: vi.fn(async () => eventos),
      marcarSincronizando: vi.fn(async () => undefined),
      remover: vi.fn(async () => undefined),
      marcarRejeitado: vi.fn(async () => undefined),
      reagendar: vi.fn(async () => undefined),
    } as unknown as OutboxRepository
    const transporte: TransporteOutbox = {
      enviar: vi.fn(async () => [
        { client_uuid: 'a', status: 'accepted' as const },
        { client_uuid: 'b', status: 'rejected' as const, reason: 'limite diário' },
        { client_uuid: 'c', status: 'retry' as const, reason: 'indisponível' },
      ]),
    }
    const service = new OutboxSyncService(transporte, repository)

    expect(await service.sincronizar()).toBe(3)
    expect(repository.remover).toHaveBeenCalledWith('a')
    expect(repository.marcarRejeitado).toHaveBeenCalledWith('b', 'limite diário')
    expect(repository.reagendar).toHaveBeenCalledWith('c', 'indisponível')
  })

  it('reagenda o lote inteiro quando o transporte falha', async () => {
    const eventos = [evento('a'), evento('b')]
    const repository = {
      listarProntos: vi.fn(async () => eventos),
      marcarSincronizando: vi.fn(async () => undefined),
      reagendar: vi.fn(async () => undefined),
    } as unknown as OutboxRepository
    const transporte: TransporteOutbox = {
      enviar: vi.fn(async () => {
        throw new Error('offline')
      }),
    }
    const service = new OutboxSyncService(transporte, repository)

    await expect(service.sincronizar()).rejects.toThrow('offline')
    expect(repository.reagendar).toHaveBeenCalledTimes(2)
  })
})
