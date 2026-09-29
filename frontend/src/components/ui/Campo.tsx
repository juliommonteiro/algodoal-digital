import { useId, type InputHTMLAttributes, type Ref } from 'react'
import { Rotulo } from './Rotulo'
import './ui.css'

export interface CampoProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string
  erro?: string | null
  id?: string
  /** React 19: ref é prop comum; o formulário usa para levar o foco ao primeiro erro. */
  ref?: Ref<HTMLInputElement>
}

export function Campo({ label, erro, id, className, ref, ...input }: CampoProps) {
  const gerado = useId()
  const idInput = id ?? `campo-${gerado}`
  const idErro = `${idInput}-erro`

  return (
    <div className={['campo', className].filter(Boolean).join(' ')}>
      <Rotulo as="label" htmlFor={idInput}>
        {label}
      </Rotulo>
      <input
        ref={ref}
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
