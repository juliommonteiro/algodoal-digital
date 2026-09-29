import type { HTMLAttributes } from 'react'
import './ui.css'

export interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: 'div' | 'article' | 'section' | 'li'
}

/** Superfície branca-quente com borda e raio de card. Para card clicável, use a classe "card" num <Link>. */
export function Card({ as: Tag = 'div', className, ...resto }: CardProps) {
  return <Tag className={['card', className].filter(Boolean).join(' ')} {...resto} />
}
