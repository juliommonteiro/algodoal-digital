import { Component, type ReactNode } from 'react'
import { AvisoDoMapa, type MotivoDoAviso } from './AvisoDoMapa'

interface Estado {
  motivo: MotivoDoAviso | null
  /** O código do mapa (chunk do MapLibre) não veio da rede. */
  falhaDeCodigo: boolean
  aindaSemRede: boolean
}

// Falha ao baixar o código do mapa (o chunk do MapLibre). O Vite pré-carrega o CSS do chunk
// antes do JS e falha primeiro nele ("Unable to preload CSS for ..."); os navegadores têm
// cada um sua mensagem para o import dinâmico que não veio.
const FALHA_DE_CARREGAMENTO =
  /unable to preload|dynamically imported module|module script|failed to fetch|networkerror/i

function ehFalhaDeCarregamento(erro: unknown): boolean {
  const texto = erro instanceof Error ? `${erro.name} ${erro.message}` : String(erro)
  return FALHA_DE_CARREGAMENTO.test(texto)
}

/**
 * Se o mapa não abrir, avisa no lugar dele em vez de derrubar a tela inteira. Distingue o
 * motivo: sem rede (o código do mapa não veio) ou sem WebGL (o navegador não desenha).
 */
export class LimiteDoMapa extends Component<{ children: ReactNode }, Estado> {
  state: Estado = { motivo: null, falhaDeCodigo: false, aindaSemRede: false }

  static getDerivedStateFromError(erro: unknown): Partial<Estado> {
    const falhaDeCodigo = ehFalhaDeCarregamento(erro)
    const semRede = falhaDeCodigo || !navigator.onLine
    return { motivo: semRede ? 'sem-arquivo' : 'sem-webgl', falhaDeCodigo, aindaSemRede: false }
  }

  componentDidCatch(erro: unknown) {
    console.error('Mapa não abriu:', erro)
  }

  private tentarDeNovo = () => {
    if (!this.state.falhaDeCodigo) {
      this.setState({ motivo: null })
      return
    }
    // O navegador guarda a falha de um import dinâmico: só recarregar a página busca o código
    // de novo. Mas recarregar sem rede, antes de o service worker guardar o app, perderia a
    // tela inteira — então, sem rede, fica o aviso.
    if (navigator.onLine) window.location.reload()
    else this.setState({ aindaSemRede: true })
  }

  render() {
    if (!this.state.motivo) return this.props.children
    return (
      <AvisoDoMapa
        motivo={this.state.motivo}
        aoTentarDeNovo={this.tentarDeNovo}
        detalhe={this.state.aindaSemRede ? 'Ainda sem conexão. Tente quando houver sinal.' : null}
      />
    )
  }
}
