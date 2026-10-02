import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Map as MapaLibre } from 'maplibre-gl'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MapaFalso } from '../../test/maplibre-falso'
import { BotaoLocalizacao } from './BotaoLocalizacao'
import { MENSAGENS } from './localizacao'

type Sucesso = (posicao: GeolocationPosition) => void
type Falha = (erro: GeolocationPositionError) => void

/** GPS de mentira: o teste decide quando e o que ele responde. */
function gpsFalso() {
  return {
    getCurrentPosition: vi.fn<(ok: Sucesso, erro: Falha, opcoes?: PositionOptions) => void>(),
    watchPosition: vi.fn<(ok: Sucesso, erro: Falha, opcoes?: PositionOptions) => number>(() => 7),
    clearWatch: vi.fn<(id: number) => void>(),
  }
}
type GpsFalso = ReturnType<typeof gpsFalso>

const posicao = (longitude: number, latitude: number, accuracy = 20) =>
  ({ coords: { longitude, latitude, accuracy }, timestamp: Date.now() }) as GeolocationPosition
const erro = (code: number) => ({ code, message: '' }) as GeolocationPositionError

const VILA = posicao(-47.58609, -0.59219, 24)
const BELEM = posicao(-48.5044, -1.4558)

let gps: GpsFalso
let mapa: MapaFalso
let permissoes: { query: ReturnType<typeof vi.fn> }

function instalar({ geolocalizacao = true, seguro = true } = {}) {
  gps = gpsFalso()
  permissoes = { query: vi.fn() }
  if (geolocalizacao) {
    Object.defineProperty(navigator, 'geolocation', { value: gps, configurable: true })
  }
  Object.defineProperty(navigator, 'permissions', { value: permissoes, configurable: true })
  Object.defineProperty(window, 'isSecureContext', { value: seguro, configurable: true })
}

function renderizar() {
  const container = document.createElement('div')
  document.body.append(container)
  // O MapLibre dos testes é o falso (vi.mock em test/setup.ts).
  mapa = new MapaLibre({ container, zoom: 14 }) as unknown as MapaFalso
  return render(<BotaoLocalizacao obterMapa={() => mapa as unknown as MapaLibre} />)
}

const botao = () => screen.getByRole('button')
const pontoAzul = () => mapa.container.querySelector<HTMLElement>('.eu')
const tocar = () => fireEvent.click(botao())
/** Responde o pedido de posição que está pendente. */
const responder = (p: GeolocationPosition) =>
  act(() => gps.getCurrentPosition.mock.calls.at(-1)![0](p))
const falhar = (code: number) => act(() => gps.getCurrentPosition.mock.calls.at(-1)![1](erro(code)))

beforeEach(() => instalar())

afterEach(() => {
  // Desmonta antes de tirar o GPS falso: a desmontagem ainda chama clearWatch.
  cleanup()
  // @ts-expect-error -- some com o que o teste instalou
  delete navigator.geolocation
  // @ts-expect-error -- idem
  delete navigator.permissions
  // @ts-expect-error -- idem
  delete window.isSecureContext
})

describe('botão de localização', () => {
  it('não pede nada ao abrir: nem posição, nem consulta de permissão', () => {
    renderizar()

    expect(botao()).toHaveAccessibleName('Mostrar minha localização')
    expect(botao()).toHaveAttribute('data-estado', 'ocioso')
    expect(gps.getCurrentPosition).not.toHaveBeenCalled()
    expect(gps.watchPosition).not.toHaveBeenCalled()
    expect(permissoes.query).not.toHaveBeenCalled()
  })

  it('dentro da ilha: busca, centraliza no zoom 15, desenha o ponto com o halo e acompanha', () => {
    renderizar()

    tocar()
    expect(botao()).toHaveAttribute('data-estado', 'buscando')
    expect(botao()).toHaveAttribute('aria-busy', 'true')
    expect(gps.getCurrentPosition.mock.calls[0][2]).toEqual({
      enableHighAccuracy: true,
      timeout: 10_000,
      maximumAge: 10_000,
    })

    responder(VILA)

    expect(mapa.easeTo).toHaveBeenCalledWith(
      expect.objectContaining({ center: [-47.58609, -0.59219], zoom: 15 }),
    )
    expect(pontoAzul()).toHaveAccessibleName('Você está aqui')
    // 24 m no zoom 14 ≈ 5 px de raio → 10 px de diâmetro
    expect(pontoAzul()!.querySelector<HTMLElement>('.eu__halo')!.style.width).toBe('10px')
    expect(botao()).toHaveAttribute('data-estado', 'ativo')
    expect(botao()).toHaveAttribute('aria-pressed', 'true')
    expect(gps.watchPosition).toHaveBeenCalledTimes(1)
    expect(permissoes.query).not.toHaveBeenCalled()
  })

  it('o halo acompanha o zoom do mapa', () => {
    renderizar()
    tocar()
    responder(VILA)

    act(() => {
      mapa.zoom = 16
      mapa.disparar('zoom')
    })

    expect(pontoAzul()!.querySelector<HTMLElement>('.eu__halo')!.style.width).toBe('40px')
  })

  it('em Belém: não centraliza, avisa que está fora e não fica acompanhando', () => {
    renderizar()
    tocar()

    responder(BELEM)

    expect(mapa.easeTo).not.toHaveBeenCalled()
    expect(screen.getByRole('status')).toHaveTextContent(
      'Você está fora de Algodoal — o mapa cobre só a ilha.',
    )
    expect(pontoAzul()).toBeNull()
    expect(gps.watchPosition).not.toHaveBeenCalled()
    expect(botao()).toHaveAttribute('data-estado', 'ocioso')
  })

  it('permissão negada: bloqueado, com a mensagem, sem exceção nem console.error', () => {
    const consoleError = vi.spyOn(console, 'error')
    renderizar()
    tocar()

    expect(() => falhar(1)).not.toThrow()

    expect(botao()).toHaveAttribute('data-estado', 'bloqueado')
    expect(botao()).toHaveAccessibleName('Localização indisponível — tocar para tentar de novo')
    expect(screen.getByRole('status')).toHaveTextContent(MENSAGENS.negada)
    expect(consoleError).not.toHaveBeenCalled()
    expect(gps.watchPosition).not.toHaveBeenCalled()

    // Bloqueado não é beco sem saída: tocar de novo pergunta outra vez.
    tocar()
    expect(gps.getCurrentPosition).toHaveBeenCalledTimes(2)
  })

  it('tempo esgotado e posição indisponível: mensagens próprias, volta a ocioso', () => {
    renderizar()
    tocar()
    falhar(3)
    expect(screen.getByRole('status')).toHaveTextContent(MENSAGENS.tempoEsgotado)
    expect(botao()).toHaveAttribute('data-estado', 'ocioso')

    tocar()
    falhar(2)
    expect(screen.getByRole('status')).toHaveTextContent(MENSAGENS.indisponivel)
  })

  it('página sem HTTPS: diz que precisa de HTTPS e nem chama o GPS', () => {
    instalar({ seguro: false })
    renderizar()

    tocar()

    expect(botao()).toHaveAttribute('data-estado', 'bloqueado')
    expect(screen.getByRole('status')).toHaveTextContent(/HTTPS/)
    expect(gps.getCurrentPosition).not.toHaveBeenCalled()
  })

  it('navegador sem geolocalização: mensagem própria', () => {
    // @ts-expect-error -- tira o GPS que o beforeEach instalou
    delete navigator.geolocation
    renderizar()

    tocar()

    expect(botao()).toHaveAttribute('data-estado', 'bloqueado')
    expect(screen.getByRole('status')).toHaveTextContent('Este navegador não oferece localização.')
  })

  it('acompanhando: move o ponto sem recentralizar; sair da ilha esconde o ponto e avisa', () => {
    renderizar()
    tocar()
    responder(VILA)
    const [aoMover, aoFalhar] = gps.watchPosition.mock.calls[0]

    act(() => aoMover(posicao(-47.59, -0.6, 10)))
    expect(mapa.easeTo).toHaveBeenCalledTimes(1) // só a primeira posição centraliza
    expect(pontoAzul()).toBeVisible()

    act(() => aoMover(BELEM))
    expect(pontoAzul()).not.toBeVisible()
    expect(screen.getByRole('status')).toHaveTextContent(MENSAGENS.fora)

    act(() => aoFalhar(erro(2)))
    expect(screen.getByRole('status')).toHaveTextContent(MENSAGENS.sinalPerdido)
    expect(botao()).toHaveAttribute('data-estado', 'ativo')

    act(() => aoFalhar(erro(1)))
    expect(botao()).toHaveAttribute('data-estado', 'bloqueado')
    expect(gps.clearWatch).toHaveBeenCalledWith(7)
    expect(pontoAzul()).toBeNull()
  })

  it('tocar de novo desliga: clearWatch e o ponto some', () => {
    renderizar()
    tocar()
    responder(VILA)

    tocar()

    expect(gps.clearWatch).toHaveBeenCalledWith(7)
    expect(pontoAzul()).toBeNull()
    expect(botao()).toHaveAttribute('data-estado', 'ocioso')
  })

  it('resposta que chega depois de desligar é ignorada', () => {
    renderizar()
    tocar()
    tocar() // desliga ainda buscando

    responder(VILA)

    expect(mapa.easeTo).not.toHaveBeenCalled()
    expect(pontoAzul()).toBeNull()
    expect(gps.watchPosition).not.toHaveBeenCalled()
  })

  it('desmontar (sair da tela do mapa) chama clearWatch', () => {
    const { unmount } = renderizar()
    tocar()
    responder(VILA)

    unmount()

    expect(gps.clearWatch).toHaveBeenCalledWith(7)
    expect(pontoAzul()).toBeNull()
  })
})
