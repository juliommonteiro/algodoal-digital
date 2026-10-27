import type { EventoOutbox } from '../db'
import { logEstruturado } from '../observabilidade'
import { outboxRepository, type OutboxRepository } from '../repositories/outboxRepository'

export type StatusResultadoEvento = 'accepted' | 'rejected' | 'retry'
export interface ResultadoEventoOutbox {
  client_uuid: string
  status: StatusResultadoEvento
  reason?: string
}
export interface TransporteOutbox {
  enviar(eventos: readonly EventoOutbox[]): Promise<readonly ResultadoEventoOutbox[]>
}

export class OutboxSyncService {
  private emAndamento: Promise<number> | null = null
  private readonly transporte: TransporteOutbox
  private readonly repository: OutboxRepository

  constructor(transporte: TransporteOutbox, repository: OutboxRepository = outboxRepository) {
    this.transporte = transporte
    this.repository = repository
  }

  sincronizar(limite = 50): Promise<number> {
    if (this.emAndamento) return this.emAndamento
    const execucao = this.executar(limite).finally(() => {
      if (this.emAndamento === execucao) this.emAndamento = null
    })
    this.emAndamento = execucao
    return execucao
  }

  private async executar(limite: number): Promise<number> {
    const eventos = await this.repository.listarProntos(limite)
    if (!eventos.length) return 0
    const ids = eventos.map((evento) => evento.client_uuid)
    await this.repository.marcarSincronizando(ids)

    let resultados: readonly ResultadoEventoOutbox[]
    try {
      resultados = await this.transporte.enviar(eventos)
    } catch (erro) {
      const mensagem = erro instanceof Error ? erro.message : 'Falha transitória ao enviar Outbox.'
      await Promise.all(ids.map((id) => this.repository.reagendar(id, mensagem)))
      logEstruturado('WARN', 'outbox_sync_transport_error', { eventos: eventos.length }, erro)
      throw erro
    }

    const porId = new Map(resultados.map((resultado) => [resultado.client_uuid, resultado]))
    for (const evento of eventos) {
      const resultado = porId.get(evento.client_uuid)
      if (!resultado) {
        await this.repository.reagendar(evento.client_uuid, 'Servidor não devolveu resultado para o evento enviado.')
      } else if (resultado.status === 'accepted') {
        await this.repository.remover(evento.client_uuid)
      } else if (resultado.status === 'rejected') {
        await this.repository.marcarRejeitado(evento.client_uuid, resultado.reason ?? 'Evento rejeitado pelo servidor.')
      } else {
        await this.repository.reagendar(evento.client_uuid, resultado.reason ?? 'Servidor solicitou nova tentativa.')
      }
    }
    logEstruturado('INFO', 'outbox_sync_complete', { eventos: eventos.length })
    return eventos.length
  }
}