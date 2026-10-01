/**
 * Garante que o catálogo entre no cache do service worker já na primeira visita.
 *
 * Na primeira visita o app busca locais e categorias logo ao abrir, antes de o service worker
 * terminar de instalar e assumir a página — essas respostas não passam por ele e não entram no
 * cache (algodoal-catalogo-v1, ver vite.config.ts). Sem isto, quem instala o app com sinal e
 * chega à ilha sem rede veria o mapa sem nenhum marcador. Quando o service worker assume
 * (controllerchange: na instalação e a cada atualização), busca de novo, agora através dele.
 */
export function aquecerCacheDoCatalogo(buscar: () => Promise<unknown>): void {
  const sw = typeof navigator !== 'undefined' ? navigator.serviceWorker : undefined
  if (!sw) return
  sw.addEventListener('controllerchange', () => {
    // Melhor esforço: sem rede agora, fica para a próxima vez que ele assumir.
    buscar().catch(() => {})
  })
}
