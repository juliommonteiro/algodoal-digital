import { describe, expect, it } from 'vitest'
import { erroCapacidade, erroWhatsApp } from './validacao'

describe('erroWhatsApp', () => {
  it.each(['(91) 98888-7777', '91988887777', '(91) 3333-4444', '+55 91 98888-7777', '5591988887777'])(
    'aceita %s',
    (numero) => {
      expect(erroWhatsApp(numero)).toBeNull()
    },
  )

  it.each(['98888-7777', '123', '+1 415 555 0100 99', '4491988887777'])('recusa %s', (numero) => {
    expect(erroWhatsApp(numero)).toMatch(/com DDD/)
  })

  it('vazio pede o número', () => {
    expect(erroWhatsApp('  ')).toMatch(/Informe seu WhatsApp/)
  })
})

describe('erroCapacidade', () => {
  it.each(['1', '2', '12'])('aceita %s', (valor) => {
    expect(erroCapacidade(valor)).toBeNull()
  })

  it.each(['', '0', '13', '2.5', 'duas'])('recusa %s', (valor) => {
    expect(erroCapacidade(valor)).toBe('Informe quantas pessoas cabem, de 1 a 12.')
  })
})
