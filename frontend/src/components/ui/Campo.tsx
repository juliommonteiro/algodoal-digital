import { useId, type InputHTMLAttributes } from 'react'
import { Rotulo } from './Rotulo'
import './ui.css'

export interface CampoProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string
  erro?: string | null
  id?: string
}

export function Campo({ label, erro, id, className, ...input }: CampoProps) {
  const gerado = useId()
  const idInput = id ?? `campo-${gerado}`
  const idErro = `${idInput}-erro`

  return (
    <div className={['campo', className].filter(Boolean).join(' ')}>
      <Rotulo as="label" htmlFor={idInput}>
        {label}
      </Rotulo>
      <input
        id={idInput}
        className="campo__input"
        aria-invalid={erro ? true : undefined}
        aria-describedby={erro ? idErro : undefined}
        {...input}
      />
      {erro && (
        <p id={idErro} className="campo__erro">
          {erro}
        </p>
      )}
    </div>
  )
}
