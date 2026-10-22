import { describe, expect, it } from 'vitest'
import { calcularBackoffMs } from '../../lib/repositories/outboxRepository'

describe('calcularBackoffMs', () => {
  it('cresce exponencialmente', () => {
    expect(calcularBackoffMs(0, 0.5)).toBe(2_000)
    expect(calcularBackoffMs(1, 0.5)).toBe(4_000)
    expect(calcularBackoffMs(2, 0.5)).toBe(8_000)
  })

  it('aplica jitter dentro de uma faixa controlada', () => {
    expect(calcularBackoffMs(0, 0)).toBe(1_500)
    expect(calcularBackoffMs(0, 1)).toBe(2_500)
  })

  it('limita a base em cinco minutos antes do jitter', () => {
    expect(calcularBackoffMs(16, 0.5)).toBe(300_000)
  })
})
