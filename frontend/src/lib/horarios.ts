// Horário de funcionamento como o formulário digita: um texto por dia, "07:00-12:00, 14:00-21:00".
// Usado pelo painel admin e pelo do parceiro; vira opening_hours ({"seg": [["07:00", "12:00"]]})
// só ao enviar.
import { DIAS } from './formatos'
import type { Negocio } from './tipos'

export type TextosDosHorarios = Record<string, string>

const FAIXA_HORARIO = /^([01]\d|2[0-3]):([0-5]\d)\s*[-–]\s*([01]\d|2[0-3]):([0-5]\d)$/

export function textosDosHorarios(horarios: Negocio['opening_hours']): TextosDosHorarios {
  return Object.fromEntries(
    Object.entries(horarios ?? {}).map(([dia, faixas]) => [
      dia,
      faixas.map(([abre, fecha]) => `${abre}-${fecha}`).join(', '),
    ]),
  )
}

/** null se o texto não estiver no formato; [] se o dia estiver vazio (fechado). */
export function faixasDoDia(texto: string): [string, string][] | null {
  const partes = texto
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
  const faixas: [string, string][] = []
  for (const parte of partes) {
    const casa = parte.match(FAIXA_HORARIO)
    if (!casa) return null
    faixas.push([`${casa[1]}:${casa[2]}`, `${casa[3]}:${casa[4]}`])
  }
  return faixas
}

/** Erros por dia, nas chaves "horarios.seg", "horarios.ter"… */
export function errosDosHorarios(textos: TextosDosHorarios): Record<string, string> {
  const erros: Record<string, string> = {}
  for (const [dia, nome] of DIAS) {
    const faixas = faixasDoDia(textos[dia] ?? '')
    if (!faixas) {
      erros[`horarios.${dia}`] = `${nome}: use HH:MM-HH:MM, ex.: 07:00-12:00, 14:00-21:00.`
    } else if (faixas.some(([abre, fecha]) => abre >= fecha)) {
      erros[`horarios.${dia}`] = `${nome}: o horário de abrir precisa vir antes do de fechar.`
    }
  }
  return erros
}

/** Só os dias com faixa; nenhum dia = null (sem horário informado). */
export function horariosDosTextos(textos: TextosDosHorarios): Negocio['opening_hours'] {
  const horarios: Record<string, [string, string][]> = {}
  for (const [dia] of DIAS) {
    const faixas = faixasDoDia(textos[dia] ?? '') ?? []
    if (faixas.length) horarios[dia] = faixas
  }
  return Object.keys(horarios).length ? horarios : null
}
