import { useOnlineStatus } from '../lib/useOnlineStatus'

export function OfflineBanner() {
  const online = useOnlineStatus()
  if (online) return null
  return (
    <div className="offline-banner" role="status">
      Sem internet. Você continua vendo o que já foi baixado.
    </div>
  )
}
