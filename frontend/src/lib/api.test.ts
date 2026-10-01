import { describe, expect, it, vi } from 'vitest'
import { ErroApi, requisitar } from './api'

function responderCom(status: number, corpo: unknown) {
  vi.mocked(fetch).mockResolvedValueOnce(
    new Response(JSON.stringify(corpo), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
}

describe('erros da API', () => {
  it('422 de validação vira ErroApi com os erros por campo (sem o "body" do loc)', async () => {
    responderCom(422, {
      detail: [
        {
          loc: ['body', 'latitude'],
          msg: 'Fora da área do mapa: a latitude…',
          type: 'fora_do_mapa',
        },
        { loc: ['body', 'business', 'whatsapp'], msg: 'Texto longo demais.', type: 'x' },
        { loc: ['body', 'latitude'], msg: 'segundo erro do mesmo campo', type: 'y' },
      ],
    })

    const erro = await requisitar('POST', '/admin/places', {}).catch((e: unknown) => e)

    expect(erro).toBeInstanceOf(ErroApi)
    expect(erro).toMatchObject({
      status: 422,
      mensagem: 'Fora da área do mapa: a latitude…',
      campos: {
        latitude: 'Fora da área do mapa: a latitude…',
        'business.whatsapp': 'Texto longo demais.',
      },
    })
  })

  it('detail em texto vira a mensagem, sem campos', async () => {
    responderCom(404, { detail: 'Local não encontrado.' })

    await expect(requisitar('GET', '/admin/places/x')).rejects.toMatchObject({
      status: 404,
      mensagem: 'Local não encontrado.',
      campos: {},
    })
  })

  it('envia o método e o corpo em JSON', async () => {
    responderCom(200, { ok: true })

    await requisitar('PATCH', '/admin/places/1', { name: 'Novo' })

    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/admin/places/1',
      expect.objectContaining({ method: 'PATCH', body: '{"name":"Novo"}' }),
    )
  })
})
