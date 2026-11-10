import { describe, expect, it } from 'vitest'
import { errosDosHorarios, faixasDoDia, horariosDosTextos, textosDosHorarios } from './horarios'

describe('horários de funcionamento', () => {
  it('lê uma ou mais faixas, com espaço ou travessão', () => {
    expect(faixasDoDia('07:00-12:00, 14:00 – 21:00')).toEqual([
      ['07:00', '12:00'],
      ['14:00', '21:00'],
    ])
    expect(faixasDoDia('')).toEqual([])
    expect(faixasDoDia('7h às 12h')).toBeNull()
  })

  it('vai e volta entre o texto e o opening_hours', () => {
    const horarios = { seg: [['09:00', '15:00'], ['18:00', '22:00']] as [string, string][] }

    const textos = textosDosHorarios(horarios)

    expect(textos).toEqual({ seg: '09:00-15:00, 18:00-22:00' })
    expect(horariosDosTextos(textos)).toEqual(horarios)
    expect(horariosDosTextos({ seg: '', ter: '' })).toBeNull()
  })

  it('aponta o dia com formato errado ou faixa invertida', () => {
    expect(errosDosHorarios({ seg: '9 às 18', ter: '22:00-09:00', qua: '' })).toEqual({
      'horarios.seg': 'Segunda: use HH:MM-HH:MM, ex.: 07:00-12:00, 14:00-21:00.',
      'horarios.ter': 'Terça: o horário de abrir precisa vir antes do de fechar.',
    })
  })
})
