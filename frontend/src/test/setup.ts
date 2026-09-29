import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'
import { definirTokenAcesso } from '../lib/api'
import { configurarMock } from '../lib/mock'

// O mock continua ativo nos testes (VITE_USAR_MOCK ausente = mock), só sem os 300ms.
beforeEach(() => {
  configurarMock({ atrasoMs: 0 })
})

afterEach(() => {
  cleanup()
  localStorage.clear()
  definirTokenAcesso(null)
  vi.restoreAllMocks()
})
