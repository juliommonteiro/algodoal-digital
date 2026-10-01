import type { RangeResponse, Source } from 'pmtiles'

export const URL_DO_ARQUIVO = '/mapa/algodoal.pmtiles'

/** Chave do arquivo no protocolo pmtiles:// (e na URL da fonte no estilo). */
export function chaveDoArquivo(origem = window.location.origin): string {
  return `${origem}${URL_DO_ARQUIVO}`
}

/**
 * Serve os pedaços do PMTiles a partir do arquivo inteiro, já em memória (707 kB).
 *
 * Por que não a FetchSource da biblioteca: ela lê por requisições parciais (cabeçalho Range), e
 * o precache do service worker responde com o arquivo inteiro, ignorando o Range — offline, a
 * leitura quebraria. Buscando o arquivo uma vez e fatiando aqui, não importa quem respondeu.
 */
export class FonteEmMemoria implements Source {
  private readonly chave: string
  private readonly dados: ArrayBuffer

  constructor(chave: string, dados: ArrayBuffer) {
    this.chave = chave
    this.dados = dados
  }

  getKey(): string {
    return this.chave
  }

  async getBytes(offset: number, length: number): Promise<RangeResponse> {
    return { data: this.dados.slice(offset, offset + length) }
  }
}

// Os 7 primeiros bytes de todo arquivo PMTiles.
const ASSINATURA = 'PMTiles'

export class ArquivoDoMapaIndisponivel extends Error {
  constructor(motivo: string) {
    super(motivo)
    this.name = 'ArquivoDoMapaIndisponivel'
  }
}

let carregamento: Promise<ArrayBuffer> | null = null

/**
 * O arquivo do mapa, buscado uma vez por sessão e reaproveitado entre remontagens. Offline, o
 * service worker responde do precache. Se falhar (primeiro acesso sem rede, antes de o service
 * worker instalar), esquece a tentativa para o "tentar de novo" buscar outra vez.
 */
export function carregarArquivoDoMapa(): Promise<ArrayBuffer> {
  carregamento ??= buscar().catch((erro: unknown) => {
    carregamento = null
    throw erro
  })
  return carregamento
}

async function buscar(): Promise<ArrayBuffer> {
  let resposta: Response
  try {
    resposta = await fetch(URL_DO_ARQUIVO)
  } catch {
    throw new ArquivoDoMapaIndisponivel('sem rede e sem o mapa guardado')
  }
  if (!resposta.ok) throw new ArquivoDoMapaIndisponivel(`HTTP ${resposta.status}`)
  const dados = await resposta.arrayBuffer()
  // Um servidor de SPA responde 200 com o index.html para caminho que não existe.
  const inicio = new TextDecoder().decode(dados.slice(0, ASSINATURA.length))
  if (inicio !== ASSINATURA) throw new ArquivoDoMapaIndisponivel('resposta não é um PMTiles')
  return dados
}

/** Só para os testes: esquece o arquivo carregado. */
export function esquecerArquivoDoMapa(): void {
  carregamento = null
}
