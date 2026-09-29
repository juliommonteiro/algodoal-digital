
export interface CarregandoProps {
  /** Quantos cartões-esqueleto mostrar. */
  itens?: number
  /** Texto lido pelo leitor de tela. */
  rotulo?: string
}

/** Esqueleto no formato da lista que vai chegar; o conteúdo não "pula" quando carrega. */
export function Carregando({ itens = 3, rotulo = 'Carregando…' }: CarregandoProps) {
  return (
    <div className="esqueleto" role="status" aria-live="polite">
      <span className="so-leitor">{rotulo}</span>
      {Array.from({ length: itens }, (_, i) => (
        <div key={i} className="esqueleto__item" aria-hidden="true">
          <span className="esqueleto__linha esqueleto__linha--curta" />
          <span className="esqueleto__linha esqueleto__linha--titulo" />
          <span className="esqueleto__linha" />
        </div>
      ))}
    </div>
  )
}
