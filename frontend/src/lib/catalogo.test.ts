import { describe, expect, it, vi } from 'vitest'
import { ErroApi, SEM_REDE } from './api'
import { buscarLocal } from './catalogo'
import { clienteMock } from './mock'

describe('buscarLocal', () => {
  it('com rede, usa o detalhe da API', async () => {
    const [primeiro] = await clienteMock.locais()
    const local = vi.spyOn(clienteMock, 'local')

    expect((await buscarLocal(primeiro.id)).name).toBe(primeiro.name)
    expect(local).toHaveBeenCalledWith(primeiro.id)
  })

  it('sem rede e sem o detalhe no cache, tira o local da lista do catálogo', async () => {
    const [, segundo] = await clienteMock.locais()
    vi.spyOn(clienteMock, 'local').mockRejectedValue(new ErroApi(SEM_REDE, 'Sem conexão.'))

    const local = await buscarLocal(segundo.id)

    expect(local).toEqual(segundo)
  })

  it('404 continua sendo 404 — não procura na lista', async () => {
    vi.spyOn(clienteMock, 'local').mockRejectedValue(new ErroApi(404, 'Local não encontrado.'))
    const locais = vi.spyOn(clienteMock, 'locais')

    await expect(buscarLocal('qualquer')).rejects.toMatchObject({ status: 404 })
    expect(locais).not.toHaveBeenCalled()
  })

  it('sem rede nem lista em cache, a falha de rede chega à tela', async () => {
    vi.spyOn(clienteMock, 'local').mockRejectedValue(new ErroApi(SEM_REDE, 'Sem conexão.'))
    vi.spyOn(clienteMock, 'locais').mockRejectedValue(new ErroApi(SEM_REDE, 'Sem conexão.'))

    await expect(buscarLocal('qualquer')).rejects.toMatchObject({ status: SEM_REDE })
  })

  it('sem rede e o local nem está na lista: falha de rede, não um local inventado', async () => {
    vi.spyOn(clienteMock, 'local').mockRejectedValue(new ErroApi(SEM_REDE, 'Sem conexão.'))

    await expect(buscarLocal('nao-esta-na-lista')).rejects.toMatchObject({ status: SEM_REDE })
  })
})
