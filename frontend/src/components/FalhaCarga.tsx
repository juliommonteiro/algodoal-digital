import type { ErroApi } from '../lib/api'
import { Botao } from './ui/Botao'
import { EstadoVazio } from './ui/EstadoVazio'

export function FalhaCarga({ erro, aoTentar }: { erro: ErroApi; aoTentar: () => void }) {
  return (
    <EstadoVazio
      titulo={erro.semRede ? 'Sem conexão' : 'Não foi possível carregar'}
      frase={erro.mensagem}
      acao={
        <Botao variante="secundario" onClick={aoTentar}>
          Tentar de novo
        </Botao>
      }
    />
  )
}
