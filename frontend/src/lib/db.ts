import Dexie, { type Table } from 'dexie'
import type { Categoria, Local } from './tipos'

const nomeBancoDeTeste =
  import.meta.env.MODE === 'test'
    ? `algodoal-digital-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    : 'algodoal-digital'

export const NOME_BANCO_LOCAL = nomeBancoDeTeste
export const VERSAO_BANCO_LOCAL = 1

export interface CategoriaLocal {
  id: string
  ordem: number
  data: Categoria
}

export interface LocalLocal {
  id: string
  category_id: string
  name: string
  ordem: number
  data: Local
}

export interface MetadadoSync {
  key: string
  value: string
  updated_at: string
}

export type StatusOutbox = 'pending' | 'syncing' | 'rejected'

export interface EventoOutbox {
  client_uuid: string
  tipo: string
  payload: unknown
  occurred_at: string
  created_at: string
  user_id: string | null
  status: StatusOutbox
  attempts: number
  next_attempt_at: string | null
  last_error: string | null
}

export class AlgodoalDatabase extends Dexie {
  declare categorias: Table<CategoriaLocal, string>
  declare locais: Table<LocalLocal, string>
  declare metadadosSync: Table<MetadadoSync, string>
  declare outbox: Table<EventoOutbox, string>

  constructor(nome = NOME_BANCO_LOCAL) {
    super(nome)

    this.version(VERSAO_BANCO_LOCAL).stores({
      categorias: 'id,ordem',
      locais: 'id,category_id,name,ordem',
      metadadosSync: 'key',
      outbox: 'client_uuid,status,tipo,created_at,next_attempt_at',
    })
  }
}

export const db = new AlgodoalDatabase()