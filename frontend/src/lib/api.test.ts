import { afterEach, describe, expect, it, vi } from 'vitest'
import { clienteHttp, definirRenovador, definirTokenAcesso, ErroApi, requisitar } from './api'

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

describe('cadastro', () => {
  function corpoEnviado(): unknown {
    const [, opcoes] = vi.mocked(fetch).mock.calls.at(-1)!
    return JSON.parse(String(opcoes?.body))
  }

  it('turista vai sem `carrier`', async () => {
    responderCom(201, {})

    await clienteHttp.registrar('Ana', 'ana@example.com', 'senha-segura')

    expect(corpoEnviado()).toEqual({ name: 'Ana', email: 'ana@example.com', password: 'senha-segura' })
  })

  it('carroceiro vai com `carrier` e nunca com `role`', async () => {
    responderCom(201, {})

    await clienteHttp.registrar('Bento', 'bento@example.com', 'senha-segura', {
      whatsapp: '(91) 98888-7777',
      capacity: 4,
    })

    expect(corpoEnviado()).toEqual({
      name: 'Bento',
      email: 'bento@example.com',
      password: 'senha-segura',
      carrier: { whatsapp: '(91) 98888-7777', capacity: 4 },
    })
  })
})

describe('token de acesso vencido ou ausente', () => {
  function cabecalhoDaChamada(indice: number): string | undefined {
    const [, opcoes] = vi.mocked(fetch).mock.calls[indice]
    return (opcoes!.headers as Record<string, string>).Authorization
  }

  afterEach(() => {
    definirRenovador(null)
    definirTokenAcesso(null)
  })

  it('401 renova a sessão e repete a chamada uma vez, com o token novo', async () => {
    definirTokenAcesso('vencido')
    const renovar = vi.fn(async () => {
      definirTokenAcesso('novo')
      return true
    })
    definirRenovador(renovar)
    responderCom(401, { detail: 'Token inválido ou expirado.' })
    responderCom(200, { ok: true })

    expect(await requisitar('GET', '/carrier/requests')).toEqual({ ok: true })
    expect(renovar).toHaveBeenCalledTimes(1)
    expect(cabecalhoDaChamada(0)).toBe('Bearer vencido')
    expect(cabecalhoDaChamada(1)).toBe('Bearer novo')
  })

  it('se não renovar, o 401 chega a quem chamou', async () => {
    definirTokenAcesso('vencido')
    definirRenovador(async () => false)
    responderCom(401, { detail: 'Token inválido ou expirado.' })

    await expect(requisitar('GET', '/carrier/requests')).rejects.toMatchObject({ status: 401 })
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('sem token (app acabou de abrir) renova antes da primeira chamada', async () => {
    definirRenovador(async () => {
      definirTokenAcesso('voltou')
      return true
    })
    responderCom(200, null)

    await requisitar('GET', '/ride-requests/current')

    expect(cabecalhoDaChamada(0)).toBe('Bearer voltou')
  })

  it('rotas de autenticação não renovam: o 401 do login é a resposta', async () => {
    const renovar = vi.fn(async () => true)
    definirRenovador(renovar)
    responderCom(401, { detail: 'E-mail ou senha incorretos.' })

    await expect(requisitar('POST', '/auth/login', {})).rejects.toMatchObject({ status: 401 })
    expect(renovar).not.toHaveBeenCalled()
  })

  it('204 vira undefined, sem tentar ler corpo', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 204 }))

    expect(await requisitar('POST', '/carrier/requests/1/decline')).toBeUndefined()
  })
})
