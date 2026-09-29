import type { ButtonHTMLAttributes, KeyboardEvent, ReactNode } from 'react'

const TECLAS_PROXIMO = new Set(['ArrowRight', 'ArrowDown'])
const TECLAS_ANTERIOR = new Set(['ArrowLeft', 'ArrowUp'])

export interface GrupoChipsProps {
  /** Nome do grupo para o leitor de tela, ex.: "Filtrar por categoria". */
  rotulo: string
  children: ReactNode
  className?: string
}

/**
 * Faixa de chips com semântica de radiogroup: Tab entra no chip ativo e as setas
 * movem a seleção, como num grupo de rádio nativo. Mantenha sempre um chip ativo.
 */
export function GrupoChips({ rotulo, children, className }: GrupoChipsProps) {
  function aoTeclar(evento: KeyboardEvent<HTMLDivElement>) {
    const { key } = evento
    if (!TECLAS_PROXIMO.has(key) && !TECLAS_ANTERIOR.has(key) && key !== 'Home' && key !== 'End') {
      return
    }
    const chips = Array.from(
      evento.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]:not(:disabled)'),
    )
    if (chips.length === 0) return
    const atual = chips.indexOf(document.activeElement as HTMLButtonElement)
    let destino = atual
    if (TECLAS_PROXIMO.has(key)) destino = (atual + 1) % chips.length
    else if (TECLAS_ANTERIOR.has(key)) destino = (atual - 1 + chips.length) % chips.length
    else if (key === 'Home') destino = 0
    else destino = chips.length - 1

    evento.preventDefault()
    chips[destino].focus()
    chips[destino].click()
    chips[destino].scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
  }

  return (
    <div
      role="radiogroup"
      aria-label={rotulo}
      className={['chips', className].filter(Boolean).join(' ')}
      // O Firefox torna o contêiner rolável focável; as setas já rolam até o chip.
      tabIndex={-1}
      onKeyDown={aoTeclar}
    >
      {children}
    </div>
  )
}

export interface ChipProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'role' | 'onClick' | 'type'> {
  ativo: boolean
  aoSelecionar: () => void
}

export function Chip({ ativo, aoSelecionar, className, children, ...resto }: ChipProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={ativo}
      tabIndex={ativo ? 0 : -1}
      className={['chip', className].filter(Boolean).join(' ')}
      onClick={aoSelecionar}
      {...resto}
    >
      {children}
    </button>
  )
}
