import { describe, expect, it } from 'vitest'
import { CENTRO_DA_VILA } from '../components/mapa/estilo'
import { clienteMock } from './mock'

// Mesmos critérios do backend (backend/tests/test_coordenadas_seed.py): o mock é o plano B da
// demonstração e tem de mostrar o mesmo mapa que a API.
const TRAPICHE: [number, number] = [-47.58714, -0.59999] // ferry_terminal "Algodoal" nos tiles
const PX_POR_GRAU = (512 * 2 ** 14) / 360
const MEIA_LARGURA = (358 / 2 - 24) / PX_POR_GRAU
const MEIA_ALTURA = (464 / 2 - 24) / PX_POR_GRAU
const visivelNoZoom14 = (lat: number, lng: number) =>
  Math.abs(lat - CENTRO_DA_VILA[1]) <= MEIA_ALTURA && Math.abs(lng - CENTRO_DA_VILA[0]) <= MEIA_LARGURA

describe('mock alinhado ao seed', () => {
  it('tem os 16 locais do seed, com o ponto de carroças no trapiche', async () => {
    const locais = await clienteMock.locais()
    const ponto = locais.find((l) => l.name === 'Ponto de Carroças')

    expect(locais).toHaveLength(16)
    expect(ponto).toBeDefined()
    const metros = Math.hypot(ponto!.latitude - TRAPICHE[1], ponto!.longitude - TRAPICHE[0]) * 111_320
    expect(metros).toBeLessThan(200)
  })

  it('pelo menos dois terços aparecem ao abrir o mapa, e os estabelecimentos todos', async () => {
    const locais = await clienteMock.locais()
    const visiveis = locais.filter((l) => visivelNoZoom14(l.latitude, l.longitude))

    expect(visiveis.length * 3).toBeGreaterThanOrEqual(locais.length * 2)
    for (const l of locais.filter((l) => l.kind === 'business')) {
      expect(visivelNoZoom14(l.latitude, l.longitude), l.name).toBe(true)
    }
  })

  it('o ponto de carroças cai em Serviços > Carroceiros', async () => {
    const [locais, categorias] = await Promise.all([clienteMock.locais(), clienteMock.categorias()])
    const ponto = locais.find((l) => l.name === 'Ponto de Carroças')!
    expect(categorias.find((c) => c.id === ponto.category_id)?.slug).toBe('carroceiros')
    expect(await clienteMock.locais({ category: 'servicos' })).toEqual([ponto])
  })
})
