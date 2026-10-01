import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type Ref,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { Rotulo } from '../components/ui/Rotulo'

// Os mesmos rótulo, borda e mensagem de erro do <Campo> (components/ui), para select, textarea
// e caixa de seleção. Só o painel usa: ficam no chunk dele.

interface Envoltorio {
  label: string
  erro?: string | null
  dica?: string
  id?: string
}

function useIds(id?: string) {
  const gerado = useId()
  const idCampo = id ?? `campo-${gerado}`
  return { idCampo, idErro: `${idCampo}-erro`, idDica: `${idCampo}-dica` }
}

function descricao(
  erro: string | null | undefined,
  dica: string | undefined,
  ids: ReturnType<typeof useIds>,
) {
  return [dica && ids.idDica, erro && ids.idErro].filter(Boolean).join(' ') || undefined
}

function Rodape({
  erro,
  dica,
  ids,
}: {
  erro?: string | null
  dica?: string
  ids: ReturnType<typeof useIds>
}) {
  return (
    <>
      {dica && (
        <p id={ids.idDica} className="campo__dica">
          {dica}
        </p>
      )}
      {erro && (
        <p id={ids.idErro} className="campo__erro">
          {erro}
        </p>
      )}
    </>
  )
}

export interface SelecaoProps
  extends Envoltorio, Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> {
  ref?: Ref<HTMLSelectElement>
  children: ReactNode
}

export function Selecao({
  label,
  erro,
  dica,
  id,
  ref,
  className,
  children,
  ...select
}: SelecaoProps) {
  const ids = useIds(id)
  return (
    <div className={['campo', className].filter(Boolean).join(' ')}>
      <Rotulo as="label" htmlFor={ids.idCampo}>
        {label}
      </Rotulo>
      <select
        ref={ref}
        id={ids.idCampo}
        className="campo__input"
        aria-invalid={erro ? true : undefined}
        aria-describedby={descricao(erro, dica, ids)}
        {...select}
      >
        {children}
      </select>
      <Rodape erro={erro} dica={dica} ids={ids} />
    </div>
  )
}

export interface AreaDeTextoProps
  extends Envoltorio, Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> {
  ref?: Ref<HTMLTextAreaElement>
}

export function AreaDeTexto({ label, erro, dica, id, ref, className, ...area }: AreaDeTextoProps) {
  const ids = useIds(id)
  return (
    <div className={['campo', className].filter(Boolean).join(' ')}>
      <Rotulo as="label" htmlFor={ids.idCampo}>
        {label}
      </Rotulo>
      <textarea
        ref={ref}
        id={ids.idCampo}
        className="campo__input campo__input--area"
        aria-invalid={erro ? true : undefined}
        aria-describedby={descricao(erro, dica, ids)}
        {...area}
      />
      <Rodape erro={erro} dica={dica} ids={ids} />
    </div>
  )
}

export interface CaixaProps
  extends Envoltorio, Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'type'> {
  ref?: Ref<HTMLInputElement>
}

export function Caixa({ label, erro, dica, id, ref, className, ...input }: CaixaProps) {
  const ids = useIds(id)
  return (
    <div className={['caixa', className].filter(Boolean).join(' ')}>
      <input
        ref={ref}
        id={ids.idCampo}
        type="checkbox"
        className="caixa__input"
        aria-invalid={erro ? true : undefined}
        aria-describedby={descricao(erro, dica, ids)}
        {...input}
      />
      <label htmlFor={ids.idCampo} className="caixa__rotulo">
        {label}
      </label>
      <Rodape erro={erro} dica={dica} ids={ids} />
    </div>
  )
}
