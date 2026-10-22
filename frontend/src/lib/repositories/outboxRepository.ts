import { db, type AlgodoalDatabase, type EventoOutbox } from '../db'

const BACKOFF_BASE_MS = 2_000
const BACKOFF_MAX_MS = 5 * 60_000

function novoUuid(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  throw new Error('Web Crypto indisponível: não é seguro criar um evento offline sem UUID.')
}

export function calcularBackoffMs(tentativas: number, aleatorio = Math.random()): number {
  const expoente = Math.max(0, Math.min(tentativas, 16))
  const semJitter = Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** expoente)
  const jitter = 0.75 + Math.min(1, Math.max(0, aleatorio)) * 0.5
  return Math.round(semJitter * jitter)
}

export interface OpcoesEventoOutbox {
  userId?: string | null
  occurredAt?: string
}

export class OutboxRepository {
  private readonly database: AlgodoalDatabase

  constructor(database: AlgodoalDatabase = db) {
    this.database = database
  }

  async adicionar(tipo: string, payload: unknown, opcoes: OpcoesEventoOutbox = {}): Promise<EventoOutbox> {
    const agora = new Date().toISOString()
    const evento: EventoOutbox = {
      client_uuid: novoUuid(),
      tipo,
      payload,
      occurred_at: opcoes.occurredAt ?? agora,
      created_at: agora,
      user_id: opcoes.userId ?? null,
      status: 'pending',
      attempts: 0,
      next_attempt_at: null,
      last_error: null,
    }
    await this.database.outbox.add(evento)
    return evento
  }

  async listarProntos(limite = 50, agora = new Date()): Promise<EventoOutbox[]> {
    const instante = agora.getTime()
    const pendentes = await this.database.outbox.where('status').equals('pending').sortBy('created_at')
    return pendentes
      .filter((evento) => !evento.next_attempt_at || Date.parse(evento.next_attempt_at) <= instante)
      .slice(0, Math.max(0, limite))
  }

  async marcarSincronizando(clientUuids: string[]): Promise<void> {
    if (!clientUuids.length) return
    await this.database.outbox.where('client_uuid').anyOf(clientUuids).modify((evento) => {
      evento.status = 'syncing'
      evento.last_error = null
    })
  }

  async reagendar(clientUuid: string, erro: string, agora = new Date()): Promise<void> {
    const evento = await this.database.outbox.get(clientUuid)
    if (!evento) return
    const attempts = evento.attempts + 1
    await this.database.outbox.update(clientUuid, {
      status: 'pending',
      attempts,
      next_attempt_at: new Date(agora.getTime() + calcularBackoffMs(attempts)).toISOString(),
      last_error: erro.slice(0, 500),
    })
  }

  async marcarRejeitado(clientUuid: string, motivo: string): Promise<void> {
    await this.database.outbox.update(clientUuid, {
      status: 'rejected',
      last_error: motivo.slice(0, 500),
      next_attempt_at: null,
    })
  }

  async remover(clientUuid: string): Promise<void> {
    await this.database.outbox.delete(clientUuid)
  }

  async recuperarSincronizacoesInterrompidas(): Promise<number> {
    return this.database.outbox.where('status').equals('syncing').modify((evento) => {
      evento.status = 'pending'
      evento.last_error = 'Sincronização anterior interrompida antes da confirmação do servidor.'
    })
  }

  async contarPendentes(): Promise<number> {
    return this.database.outbox.where('status').equals('pending').count()
  }
}

export const outboxRepository = new OutboxRepository()