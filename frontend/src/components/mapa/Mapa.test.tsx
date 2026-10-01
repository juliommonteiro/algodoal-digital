import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clienteMock } from '../../lib/mock'
import { mapasCriados, type MapaFalso } from '../../test/maplibre-falso'
import { renderizarEm } from '../../test/utils'
import { CENTRO_DA_VILA, LIMITES, ZOOM_INICIAL } from './estilo'

beforeEach(() => {
  mapasCriados.length = 0
})

async function abrirMapa(): Promise<MapaFalso> {
  renderizarEm('/')
  await waitFor(() => expect(document.querySelectorAll('.marcador')).toHaveLength(15))
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

  it('põe um marcador por local da API, com nome, categoria e coordenada', async () => {
    await abrirMapa()
    const locais = await clienteMock.locais()

    for (const local of locais) {
      const botao = marcadores().find((m) => m.dataset.localId === local.id)
      expect(botao, local.name).toBeDefined()
      expect(botao!.getAttribute('aria-label')).toMatch(new RegExp(`^${local.name}, `))
      expect(botao!.style.getPropertyValue('--cor-marcador')).toMatch(/^#[0-9a-f]{6}$/)
    }
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
    expect(marcadores()).toHaveLength(15)
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
