export interface Aviso {
  tipo: 'sucesso' | 'erro'
  texto: string
}

/** Mensagem de sucesso ou de erro de uma operação, num lugar que o leitor de tela anuncia. */
export function CaixaDeAviso({ aviso }: { aviso: Aviso | null }) {
  return (
    <div role="status" aria-live="polite" className="admin-aviso__lugar">
      {aviso && <p className={`admin-aviso admin-aviso--${aviso.tipo}`}>{aviso.texto}</p>}
    </div>
  )
}
