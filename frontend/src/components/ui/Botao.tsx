import type { ButtonHTMLAttributes } from 'react'
import { classesBotao, type VarianteBotao } from './classes'
import './ui.css'

export interface BotaoProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: VarianteBotao
  /** Mostra o indicador e bloqueia novo clique, sem trocar o texto (o leitor de tela ouve aria-busy). */
  carregando?: boolean
}

export function Botao({
  variante = 'primario',
  carregando = false,
  disabled,
  className,
  type = 'button',
  children,
  ...resto
}: BotaoProps) {
  return (
    <button
      type={type}
      className={classesBotao(variante, className)}
      disabled={disabled || carregando}
      aria-busy={carregando || undefined}
      {...resto}
    >
      {carregando && (
        <span className="botao__pontos" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      )}
      {children}
    </button>
  )
}
