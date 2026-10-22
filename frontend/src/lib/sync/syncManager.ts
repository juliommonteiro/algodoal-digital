import { logEstruturado } from '../observabilidade'
import { outboxRepository } from '../repositories/outboxRepository'
import { catalogSync } from './syncCatalogo'

let pararAtual: (() => void) | null = null

export function iniciarSyncManager(): () => void {
  if (pararAtual) return pararAtual
  let timer: ReturnType<typeof setTimeout> | null = null
  let encerrado = false

  const tentar = (origem: string) => {
    if (encerrado) return
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
      void catalogSync.sincronizar().catch((erro) => {
        logEstruturado('WARN', 'catalog_sync_failed', { origem }, erro)
      })
    }, 250)
  }
  const aoFicarOnline = () => tentar('online_event')
  const aoMudarVisibilidade = () => {
    if (document.visibilityState === 'visible') tentar('visibility_event')
  }
  const aoTrocarServiceWorker = () => tentar('service_worker_controllerchange')

  if (typeof window !== 'undefined') window.addEventListener('online', aoFicarOnline)
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', aoMudarVisibilidade)
  if (typeof navigator !== 'undefined' && navigator.serviceWorker) {
    navigator.serviceWorker.addEventListener('controllerchange', aoTrocarServiceWorker)
  }
  void outboxRepository.recuperarSincronizacoesInterrompidas().catch((erro) => {
    logEstruturado('ERROR', 'outbox_recovery_failed', {}, erro)
  })
  tentar('startup')

  pararAtual = () => {
    encerrado = true
    if (timer) clearTimeout(timer)
    timer = null
    if (typeof window !== 'undefined') window.removeEventListener('online', aoFicarOnline)
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', aoMudarVisibilidade)
    if (typeof navigator !== 'undefined' && navigator.serviceWorker) {
      navigator.serviceWorker.removeEventListener('controllerchange', aoTrocarServiceWorker)
    }
    pararAtual = null
  }
  return pararAtual
}