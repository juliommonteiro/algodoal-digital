import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clienteMock } from '../../lib/mock'
import { mapasCriados, type MapaFalso } from '../../test/maplibre-falso'
import { renderizarEm } from '../../test/utils'
import { CENTRO_DA_VILA, LIMITES, ZOOM_INICIAL } from './estilo'
import { CAMINHOS_DO_TIPO, TIPOS } from './icones'

beforeEach(() => {
  mapasCriados.length = 0
})

async function abrirMapa(): Promise<MapaFalso> {
  renderizarEm('/')
  await waitFor(() => expect(document.querySelectorAll('.marcador')).toHaveLength(16))
  return mapasCriados.at(-1)!
}

const marcadores = () => [...document.querySelectorAll<HTMLButtonElement>('.marcador')]

describe('mapa', () => {
  it('abre na vila, preso ao recorte do arquivo, com a atribuição sempre aberta', async () => {
    const mapa = await abrirMapa()

    expect(mapa.opcoes).toMatchObject({
      center: CENTRO_DA_VILA,
      zoom: ZOOM_INICIAL,
      maxBounds: LIMITES,
      attributionControl: false,
    })
    expect(String(mapa.opcoes.style && JSON.stringify(mapa.opcoes.style))).toContain(
      '© OpenStreetMap contributors',
    )
    const atribuicao = mapa.controles.find(
      (c) => (c.controle as { opcoes?: { compact?: boolean } }).opcoes?.compact === false,
    )
    expect(atribuicao, 'AttributionControl com compact:false').toBeDefined()
    expect(JSON.stringify(atribuicao)).toContain('Protomaps')
  })

  it('põe um marcador por local, com o ícone e a cor do tipo e "nome, tipo" no aria-label', async () => {
    await abrirMapa()
    const locais = await clienteMock.locais()

    for (const local of locais) {
      const botao = marcadores().find((m) => m.dataset.localId === local.id)
      expect(botao, local.name).toBeDefined()
      const tipo = TIPOS[local.kind]
      expect(botao!.getAttribute('aria-label')).toBe(
        `${local.name}, ${tipo.rotulo.toLocaleLowerCase('pt-BR')}`,
      )
      expect(botao!.dataset.tipo).toBe(local.kind)
      // A cor é a classe do grupo, pintada no mapa.css com o token — nada de hex no elemento.
      expect(botao!.querySelector('.marcador__pino')).toHaveClass(`pino--${tipo.grupo}`)
      expect(botao!.getAttribute('style') ?? '').not.toMatch(/#[0-9a-f]{3,6}/i)
      // O ícone do tipo, decorativo (o nome do tipo já está no aria-label).
      const svg = botao!.querySelector('.marcador__pino svg')!
      expect(svg).toHaveAttribute('aria-hidden', 'true')
      expect([...svg.querySelectorAll('path')].map((p) => p.getAttribute('d'))).toEqual(
        CAMINHOS_DO_TIPO[local.kind],
      )
    }
  })

  it('o marcador é um botão nativo: alcançável com Tab e aberto com Enter ou espaço', async () => {
    await abrirMapa()

    const praia = marcadores().find(
      (m) => m.getAttribute('aria-label') === 'Praia do Sol Deitado, praia',
    )!
    expect(praia).toBeDefined()
    expect(praia.tagName).toBe('BUTTON')
    expect(praia).toHaveAttribute('type', 'button')
    expect(praia.tabIndex).toBe(0)
    expect(marcadores().map((m) => m.getAttribute('aria-label'))).toContain(
      'Restaurante Vento Sul, estabelecimento',
    )

    // O jsdom não converte Enter/espaço em clique como o navegador faz num <button>; o clique é
    // o que o navegador dispara. (Conferido com teclado de verdade no Firefox.)
    praia.focus()
    fireEvent.click(praia)
    expect(
      await screen.findByRole('heading', { name: 'Praia do Sol Deitado', level: 2 }),
    ).toBeInTheDocument()
  })

  it('mostra a legenda fechada no canto do mapa', async () => {
    await abrirMapa()

    expect(screen.getByRole('button', { name: 'Legenda' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
  })

  it('os chips filtram os marcadores no cliente, sem chamar a API de novo', async () => {
    const chamadas = vi.spyOn(clienteMock, 'locais')
    await abrirMapa()
    const grupo = screen.getByRole('radiogroup', { name: 'Filtrar por categoria' })

    fireEvent.click(within(grupo).getByRole('radio', { name: 'Alimentação' }))
    expect(marcadores()).toHaveLength(3)
    expect(new Set(marcadores().map((m) => m.dataset.categoria))).toEqual(new Set(['alimentacao']))

    fireEvent.click(within(grupo).getByRole('radio', { name: 'Turismo' }))
    expect(marcadores()).toHaveLength(7)

    fireEvent.click(within(grupo).getByRole('radio', { name: 'Todas' }))
    expect(marcadores()).toHaveLength(16)
    expect(chamadas).toHaveBeenCalledTimes(1) // só a carga inicial
  })

  it('tocar num marcador abre o card, e "Ver detalhes" leva ao local', async () => {
    const mapa = await abrirMapa()
    const restaurante = marcadores().find((m) => m.getAttribute('aria-label')?.startsWith('Restaurante Vento Sul'))!

    fireEvent.click(restaurante)

    const card = await screen.findByRole('heading', { name: 'Restaurante Vento Sul', level: 2 })
    expect(card).toBeInTheDocument()
    expect(restaurante).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText(/^Restaurantes · /)).toBeInTheDocument()

    // Tocar no mapa fora dos marcadores fecha
    act(() => mapa.disparar('click'))
    expect(screen.queryByRole('heading', { name: 'Restaurante Vento Sul', level: 2 })).not.toBeInTheDocument()

    fireEvent.click(restaurante)
    const link = await screen.findByRole('link', { name: 'Ver detalhes' })
    expect(link).toHaveAttribute('href', `/local/${restaurante.dataset.localId}`)
    fireEvent.click(link)
    expect(await screen.findByRole('heading', { name: 'Restaurante Vento Sul', level: 1 })).toBeInTheDocument()
  })

  it('o filtro que tira o local aberto fecha o card', async () => {
    await abrirMapa()
    const praia = marcadores().find((m) => m.dataset.categoria === 'turismo')!
    fireEvent.click(praia)
    expect(await screen.findByRole('link', { name: 'Ver detalhes' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('radio', { name: 'Alimentação' }))

    expect(screen.queryByRole('link', { name: 'Ver detalhes' })).not.toBeInTheDocument()
  })

  it('sair da tela do mapa com a localização ligada encerra o acompanhamento', async () => {
    const gps = {
      getCurrentPosition: vi.fn((ok: (p: GeolocationPosition) => void) =>
        ok({
          coords: { longitude: -47.58609, latitude: -0.59219, accuracy: 15 },
        } as GeolocationPosition),
      ),
      watchPosition: vi.fn(() => 3),
      clearWatch: vi.fn(),
    }
    Object.defineProperty(navigator, 'geolocation', { value: gps, configurable: true })
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true })
    try {
      const mapa = await abrirMapa()
      expect(gps.getCurrentPosition).not.toHaveBeenCalled() // nada ao abrir

      fireEvent.click(screen.getByRole('button', { name: 'Mostrar minha localização' }))
      expect(mapa.easeTo).toHaveBeenCalledWith(expect.objectContaining({ zoom: 15 }))
      expect(gps.watchPosition).toHaveBeenCalledTimes(1)

      fireEvent.click(screen.getByRole('link', { name: 'Diretório' }))

      expect(await screen.findByRole('heading', { name: 'Diretório', level: 1 })).toBeInTheDocument()
      expect(gps.clearWatch).toHaveBeenCalledWith(3)
    } finally {
      cleanup()
      // @ts-expect-error -- some com o que o teste instalou
      delete navigator.geolocation
      // @ts-expect-error -- idem
      delete window.isSecureContext
    }
  })

  it('sem o arquivo (primeiro acesso sem rede) explica e deixa tentar de novo', async () => {
    const fetch = vi.mocked(globalThis.fetch)
    fetch.mockRejectedValueOnce(new TypeError('NetworkError when attempting to fetch resource.'))
    renderizarEm('/')

    expect(await screen.findByRole('heading', { name: 'O mapa ainda não foi baixado' })).toBeInTheDocument()
    expect(screen.getByText(/Abra o mapa uma vez com internet/)).toBeInTheDocument()
    expect(mapasCriados).toHaveLength(0)

    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))

    await waitFor(() => expect(mapasCriados).toHaveLength(1))
    expect(screen.queryByRole('heading', { name: 'O mapa ainda não foi baixado' })).not.toBeInTheDocument()
  })
})
