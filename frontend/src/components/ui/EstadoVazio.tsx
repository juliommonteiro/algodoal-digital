import type { ReactNode } from 'react'

export interface EstadoVazioProps {
  titulo: string
  frase: string
  icone?: ReactNode
  /** Botão ou link opcional, ex.: "Tentar de novo". */
  acao?: ReactNode
  /** Nível do título; o padrão (h2) serve para um bloco dentro da página. */
  nivel?: 'h1' | 'h2' | 'h3'
}

export function EstadoVazio({ titulo, frase, icone, acao, nivel: Titulo = 'h2' }: EstadoVazioProps) {
  return (
    <div className="vazio">
      {icone && (
        <div className="vazio__icone" aria-hidden="true">
          {icone}
        </div>
      )}
      <Titulo className="vazio__titulo">{titulo}</Titulo>
      <p className="vazio__frase">{frase}</p>
      {acao && <div className="vazio__acao">{acao}</div>}
    </div>
  )
}
