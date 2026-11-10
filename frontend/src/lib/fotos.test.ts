import { afterEach, describe, expect, it, vi } from 'vitest'
import { prepararFoto } from './fotos'

describe('prepararFoto', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('sem createImageBitmap, envia o arquivo como está', async () => {
    vi.stubGlobal('createImageBitmap', undefined)
    const arquivo = new File(['x'], 'foto.png', { type: 'image/png' })

    expect(await prepararFoto(arquivo)).toBe(arquivo)
  })

  it('reduz para 1600 px no lado maior e regrava em JPEG', async () => {
    const fechar = vi.fn()
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => ({ width: 4000, height: 3000, close: fechar })),
    )
    const desenhar = vi.fn()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: desenhar,
    } as unknown as CanvasRenderingContext2D)
    let tamanho: [number, number] = [0, 0]
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
      this: HTMLCanvasElement,
      pronto,
      tipo,
    ) {
      tamanho = [this.width, this.height]
      pronto(new Blob(['jpeg'], { type: tipo }))
    })

    const resultado = await prepararFoto(new File(['x'], 'grande.jpg', { type: 'image/jpeg' }))

    expect(tamanho).toEqual([1600, 1200])
    expect(resultado.type).toBe('image/jpeg')
    expect(desenhar).toHaveBeenCalledOnce()
    expect(fechar).toHaveBeenCalledOnce()
  })

  it('foto pequena não é ampliada', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width: 800, height: 600, close() {} })))
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage() {},
    } as unknown as CanvasRenderingContext2D)
    let largura = 0
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
      this: HTMLCanvasElement,
      pronto,
    ) {
      largura = this.width
      pronto(new Blob(['jpeg'], { type: 'image/jpeg' }))
    })

    await prepararFoto(new File(['x'], 'pequena.jpg', { type: 'image/jpeg' }))

    expect(largura).toBe(800)
  })

  it('formato que o navegador não abre volta o arquivo original (a API decide)', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn(async () => Promise.reject(new Error('HEIC'))))
    const arquivo = new File(['x'], 'foto.heic', { type: 'image/heic' })

    expect(await prepararFoto(arquivo)).toBe(arquivo)
  })
})
