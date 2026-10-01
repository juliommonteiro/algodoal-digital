import { Botao } from '../ui/Botao'
import { EstadoVazio } from '../ui/EstadoVazio'

export type MotivoDoAviso = 'sem-arquivo' | 'sem-webgl'

const TEXTOS: Record<MotivoDoAviso, { titulo: string; frase: string }> = {
  // Primeiro acesso sem rede, antes de o service worker guardar o mapa.
  'sem-arquivo': {
    titulo: 'O mapa ainda não foi baixado',
    // Sem prometer a lista: sem rede, o catálogo também não vem até a S8 (IndexedDB).
    frase:
      'Abra o mapa uma vez com internet: ele fica guardado no celular e depois funciona ' +
      'sem sinal.',
  },
  'sem-webgl': {
    titulo: 'Não foi possível desenhar o mapa',
    frase:
      'Este navegador não conseguiu desenhar o mapa. ' +
      'A lista de locais logo abaixo continua funcionando.',
  },
}

/** Aviso no lugar do mapa — nunca uma área em branco. */
export function AvisoDoMapa({
  motivo,
  aoTentarDeNovo,
  detalhe = null,
}: {
  motivo: MotivoDoAviso
  aoTentarDeNovo: () => void
  /** Retorno ao "tentar de novo" que não pôde ser feito (ex.: continua sem rede). */
  detalhe?: string | null
}) {
  const { titulo, frase } = TEXTOS[motivo]
  return (
    <div className="mapa mapa--aviso" role="status">
      <EstadoVazio
        titulo={titulo}
        frase={frase}
        acao={
          <>
            <Botao variante="secundario" onClick={aoTentarDeNovo}>
              Tentar de novo
            </Botao>
            {detalhe && <p className="mapa__detalhe">{detalhe}</p>}
          </>
        }
      />
    </div>
  )
}
