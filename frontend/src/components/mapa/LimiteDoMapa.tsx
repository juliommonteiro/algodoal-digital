import { Component, type ReactNode } from 'react'
import { Botao } from '../ui/Botao'
import { EstadoVazio } from '../ui/EstadoVazio'

interface Estado {
  erro: boolean
}

/**
 * Se o mapa não abrir — sem WebGL, ou o chunk do MapLibre não carregou —, avisa no lugar dele
 * em vez de derrubar a tela inteira. A lista de locais abaixo continua funcionando.
 */
export class LimiteDoMapa extends Component<{ children: ReactNode }, Estado> {
  state: Estado = { erro: false }

  static getDerivedStateFromError(): Estado {
    return { erro: true }
  }

  componentDidCatch(erro: unknown) {
    console.error('Mapa não abriu:', erro)
  }

  render() {
    if (!this.state.erro) return this.props.children
    return (
      <div className="mapa mapa--aviso" role="status">
        <EstadoVazio
          titulo="Não foi possível abrir o mapa"
          frase={
            'Este navegador não conseguiu desenhar o mapa. ' +
            'A lista de locais logo abaixo continua funcionando.'
          }
          acao={
            <Botao variante="secundario" onClick={() => this.setState({ erro: false })}>
              Tentar de novo
            </Botao>
          }
        />
      </div>
    )
  }
}
