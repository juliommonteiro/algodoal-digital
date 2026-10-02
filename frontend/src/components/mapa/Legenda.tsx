import { useId, useRef, useState, type CSSProperties } from 'react'
import type { TipoLocal } from '../../lib/tipos'
import { GRUPOS, TIPOS, type GrupoDoTipo } from './icones'

const TIPOS_DO_GRUPO = Object.entries(TIPOS) as [TipoLocal, (typeof TIPOS)[TipoLocal]][]

/**
 * Legenda dos marcadores, no canto do mapa. Fechada é só um botão pequeno; aberta lista os
 * quatro grupos (cor do pino) e os sete tipos (ícone). Não guarda o estado: abre fechada.
 */
export function Legenda() {
  const [aberta, setAberta] = useState(false)
  const idConteudo = useId()
  const botao = useRef<HTMLButtonElement>(null)

  return (
    <div
      className="legenda"
      // Esc fecha e devolve o foco ao botão, para quem navega pelo teclado.
      onKeyDown={(evento) => {
        if (evento.key === 'Escape' && aberta) {
          setAberta(false)
          botao.current?.focus()
        }
      }}
    >
      <button
        ref={botao}
        type="button"
        className="legenda__botao"
        aria-expanded={aberta}
        aria-controls={idConteudo}
        onClick={() => setAberta((antes) => !antes)}
      >
        {aberta ? 'Fechar legenda' : 'Legenda'}
      </button>
      <div id={idConteudo} className="legenda__conteudo" hidden={!aberta}>
        {(Object.entries(GRUPOS) as [GrupoDoTipo, (typeof GRUPOS)[GrupoDoTipo]][]).map(
          ([grupo, { rotulo, cor }]) => (
            <div key={grupo} className="legenda__grupo">
              <p className="legenda__titulo" id={`${idConteudo}-${grupo}`}>
                {rotulo}
              </p>
              <ul aria-labelledby={`${idConteudo}-${grupo}`}>
                {TIPOS_DO_GRUPO.filter(([, dados]) => dados.grupo === grupo).map(
                  ([tipo, { icone: Icone, rotulo: rotuloDoTipo }]) => (
                    <li key={tipo} className="legenda__tipo">
                      <span
                        className="legenda__pino"
                        style={{ '--cor-marcador': cor } as CSSProperties}
                      >
                        <Icone width={14} height={14} />
                      </span>
                      {rotuloDoTipo}
                    </li>
                  ),
                )}
              </ul>
            </div>
          ),
        )}
      </div>
    </div>
  )
}
