import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'
import { esquecerArquivoDoMapa } from '../components/mapa/arquivo'
import { definirTokenAcesso } from '../lib/api'
import { configurarMock, reiniciarBancoDoMock } from '../lib/mock'
import { pmtilesFalso } from './utils'

// O jsdom não tem WebGL: o mapa roda sobre um MapLibre falso, que registra o que foi pedido.
vi.mock('maplibre-gl', () => import('./maplibre-falso'))
vi.mock('maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url', () => ({ default: '/worker.js' }))

// O mock continua ativo nos testes (VITE_USAR_MOCK ausente = mock), só sem os 300ms.
beforeEach(() => {
  configurarMock({ atrasoMs: 0 })
  reiniciarBancoDoMock()
  esquecerArquivoDoMapa()
  // A única coisa que o app busca com fetch nos testes é o arquivo do mapa.
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (entrada) => {
    if (String(entrada).endsWith('/mapa/algodoal.pmtiles')) return new Response(pmtilesFalso())
    throw new TypeError('fetch fora do esperado no teste: ' + String(entrada))
  })
})

afterEach(() => {
  cleanup()
  localStorage.clear()
  definirTokenAcesso(null)
  vi.restoreAllMocks()
})
