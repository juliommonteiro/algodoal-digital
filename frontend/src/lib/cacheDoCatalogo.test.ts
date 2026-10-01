import { afterEach, describe, expect, it, vi } from 'vitest'
import { aquecerCacheDoCatalogo } from './cacheDoCatalogo'

function comServiceWorker(sw: EventTarget | undefined) {
  Object.defineProperty(navigator, 'serviceWorker', { value: sw, configurable: true })
}

afterEach(() => {
  Reflect.deleteProperty(navigator, 'serviceWorker')
})

describe('aquecerCacheDoCatalogo', () => {
  it('busca o catálogo de novo quando o service worker assume a página', () => {
    const sw = new EventTarget()
    comServiceWorker(sw)
    const buscar = vi.fn().mockResolvedValue(undefined)

    aquecerCacheDoCatalogo(buscar)
    expect(buscar).not.toHaveBeenCalled() // na abertura, a tela já busca sozinha

    sw.dispatchEvent(new Event('controllerchange'))
    expect(buscar).toHaveBeenCalledTimes(1)

    sw.dispatchEvent(new Event('controllerchange')) // atualização do app: busca de novo
    expect(buscar).toHaveBeenCalledTimes(2)
  })

  it('sem rede na hora, a falha não vaza (melhor esforço)', async () => {
    const sw = new EventTarget()
    comServiceWorker(sw)
    const buscar = vi.fn().mockRejectedValue(new TypeError('NetworkError'))

    aquecerCacheDoCatalogo(buscar)
    sw.dispatchEvent(new Event('controllerchange'))

    await Promise.resolve()
    expect(buscar).toHaveBeenCalledTimes(1)
  })

  it('navegador sem service worker: não faz nada', () => {
    comServiceWorker(undefined)
    const buscar = vi.fn()

    expect(() => aquecerCacheDoCatalogo(buscar)).not.toThrow()
    expect(buscar).not.toHaveBeenCalled()
  })
})
