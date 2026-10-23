import { liveQuery } from 'dexie'
import { useEffect, useState } from 'react'
import { catalogoRepository } from '../lib/repositories/catalogoRepository'
import { useOnlineStatus } from '../lib/useOnlineStatus'

function formatarUltimaSync(valor: string | null): string {
  if (!valor) return 'Faça uma sincronização online para preparar o uso offline.'

  const data = new Date(valor)
  if (Number.isNaN(data.getTime())) return 'Dados locais disponíveis neste aparelho.'

  return `Dados salvos às ${new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(data)}.`
}

export function OfflineBanner() {
  const online = useOnlineStatus()
  const [ultimaSync, setUltimaSync] = useState<string | null>(null)

  useEffect(() => {
    const assinatura = liveQuery(() => catalogoRepository.ultimaSincronizacao()).subscribe({
      next: setUltimaSync,
      error: () => setUltimaSync(null),
    })
    return () => assinatura.unsubscribe()
  }, [])

  return (
    <div
      className={online ? 'connection-status connection-status--online' : 'connection-status connection-status--offline'}
      role="status"
      aria-live="polite"
    >
      <div className="connection-status__inner">
        <span className="connection-status__dot" aria-hidden="true" />
        <div className="connection-status__textos">
          <strong>{online ? 'Conectado' : 'Sem internet'}</strong>
          <span>
            {online
              ? ultimaSync
                ? `Conteúdo offline pronto. ${formatarUltimaSync(ultimaSync)}`
                : 'Preparando conteúdo para uso offline.'
              : ultimaSync
                ? `Você continua usando o conteúdo salvo. ${formatarUltimaSync(ultimaSync)}`
                : 'Conecte-se para baixar o conteúdo essencial da ilha.'}
          </span>
        </div>
      </div>
    </div>
  )
}
