import { describe, expect, it, vi } from 'vitest'
import { pmtilesFalso } from '../../test/utils'
import { ArquivoDoMapaIndisponivel, carregarArquivoDoMapa, FonteEmMemoria } from './arquivo'

describe('FonteEmMemoria', () => {
  it('serve os pedaços pedidos a partir do arquivo em memória', async () => {
    const dados = new Uint8Array([10, 11, 12, 13, 14, 15, 16, 17]).buffer
    const fonte = new FonteEmMemoria('chave-do-mapa', dados)

    const pedaco = await fonte.getBytes(2, 3)

    expect(fonte.getKey()).toBe('chave-do-mapa')
    expect([...new Uint8Array(pedaco.data)]).toEqual([12, 13, 14])
    expect(pedaco.data.byteLength).toBe(3)
    // Pedido que passa do fim devolve só o que existe, como uma resposta de Range faria
    expect([...new Uint8Array((await fonte.getBytes(6, 10)).data)]).toEqual([16, 17])
  })
})

describe('carregarArquivoDoMapa', () => {
  it('busca uma vez por sessão e reaproveita entre remontagens', async () => {
    const fetch = vi.mocked(globalThis.fetch)

    const a = await carregarArquivoDoMapa()
    const b = await carregarArquivoDoMapa()

    expect(a).toBe(b)
    expect(fetch).toHaveBeenCalledTimes(1)
    // fetch comum, sem cabeçalho Range: o precache do service worker responde o arquivo inteiro
    expect(fetch).toHaveBeenCalledWith('/mapa/algodoal.pmtiles')
  })

  it('sem rede rejeita com ArquivoDoMapaIndisponivel, e tentar de novo busca outra vez', async () => {
    const fetch = vi.mocked(globalThis.fetch)
    fetch.mockRejectedValueOnce(new TypeError('NetworkError when attempting to fetch resource.'))

    await expect(carregarArquivoDoMapa()).rejects.toBeInstanceOf(ArquivoDoMapaIndisponivel)
    await expect(carregarArquivoDoMapa()).resolves.toBeInstanceOf(ArrayBuffer)
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('recusa resposta que não é PMTiles (o index.html de um servidor de SPA)', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response('<!doctype html><html></html>', { headers: { 'Content-Type': 'text/html' } }),
    )

    await expect(carregarArquivoDoMapa()).rejects.toThrow('não é um PMTiles')
  })

  it('recusa resposta HTTP de erro', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(new Response('', { status: 404 }))

    await expect(carregarArquivoDoMapa()).rejects.toThrow('HTTP 404')
    expect(new Uint8Array(pmtilesFalso()).length).toBeGreaterThan(7)
  })
})
