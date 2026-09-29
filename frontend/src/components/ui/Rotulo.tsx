import type { HTMLAttributes, LabelHTMLAttributes } from 'react'
import './ui.css'

type RotuloProps =
  | ({ as?: 'span' | 'p' | 'h2' | 'h3' } & HTMLAttributes<HTMLElement>)
  | ({ as: 'label' } & LabelHTMLAttributes<HTMLLabelElement>)

/** Label em maiúscula (IBM Plex Mono 11px, 500, espaçado, cor --suave). */
export function Rotulo({ as: Tag = 'span', className, ...resto }: RotuloProps) {
  const classes = ['rotulo', className].filter(Boolean).join(' ')
  return <Tag className={classes} {...(resto as HTMLAttributes<HTMLElement>)} />
}
