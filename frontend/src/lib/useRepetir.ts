import { useEffect, useRef } from 'react'

/**
 * Chama `acao` a cada `intervaloMs` enquanto `ativo`. Pausa com a aba escondida ou sem rede,
 * e chama de novo assim que a aba volta: é o "tempo real" da carroça, sem push nem WebSocket.
 */
export function useRepetir(acao: () => void, intervaloMs: number, ativo: boolean): void {
  const acaoRef = useRef(acao)

  useEffect(() => {
    acaoRef.current = acao
  })

  useEffect(() => {
    if (!ativo) return
    const rodar = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) acaoRef.current()
    }
    const id = window.setInterval(rodar, intervaloMs)
    const aoVoltar = () => {
      if (document.visibilityState === 'visible') rodar()
    }
    document.addEventListener('visibilitychange', aoVoltar)
    window.addEventListener('online', rodar)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', aoVoltar)
      window.removeEventListener('online', rodar)
    }
  }, [intervaloMs, ativo])
}
