import { describe, expect, it } from 'vitest'
import { LESTE, NORTE, OESTE, SUL } from '../../lib/areaDoMapa'
import {
  decidirPosicao,
  impedimentoDoNavegador,
  MENSAGENS,
  OPCOES_DA_PRIMEIRA_POSICAO,
  OPCOES_DO_ACOMPANHAMENTO,
  raioEmPixels,
  resultadoDoErro,
  resultadoDoErroAcompanhando,
  ZOOM_DA_LOCALIZACAO,
} from './localizacao'

const posicao = (longitude: number, latitude: number, accuracy = 12) => ({
  longitude,
  latitude,
  accuracy,
})

describe('decidir o que fazer com a posição', () => {
  it('dentro do recorte: centraliza nela, no zoom 15, com a precisão para o halo', () => {
    // Vila de Algodoal
    expect(decidirPosicao(posicao(-47.58609, -0.59219, 8))).toEqual({
      dentro: true,
      centro: [-47.58609, -0.59219],
      zoom: 15,
      precisao: 8,
    })
    expect(ZOOM_DA_LOCALIZACAO).toBe(15)
  })

  it('em Belém (-48.5044, -1.4558): não centraliza e avisa que está fora', () => {
    expect(decidirPosicao(posicao(-48.5044, -1.4558))).toEqual({
      dentro: false,
      aviso: 'Você está fora de Algodoal — o mapa cobre só a ilha.',
    })
  })

  it('na borda exata conta como dentro, como os locais na API; um passo além, fora', () => {
    const bordas: [number, number][] = [
      [OESTE, -0.6],
      [LESTE, -0.6],
      [-47.6, SUL],
      [-47.6, NORTE],
      [OESTE, SUL],
      [LESTE, NORTE],
    ]
    for (const [lng, lat] of bordas) {
      expect(decidirPosicao(posicao(lng, lat)).dentro, `${lng}, ${lat}`).toBe(true)
    }
    const passo = 1e-6
    const alem: [number, number][] = [
      [OESTE - passo, -0.6],
      [LESTE + passo, -0.6],
      [-47.6, SUL - passo],
      [-47.6, NORTE + passo],
    ]
    for (const [lng, lat] of alem) {
      expect(decidirPosicao(posicao(lng, lat)).dentro, `${lng}, ${lat}`).toBe(false)
    }
  })
})

describe('antes de pedir a permissão', () => {
  it('página sem HTTPS (http num IP de rede): bloqueado, dizendo que precisa de HTTPS', () => {
    const resultado = impedimentoDoNavegador({ temGeolocalizacao: true, contextoSeguro: false })
    expect(resultado).toEqual({ estado: 'bloqueado', aviso: MENSAGENS.semHttps })
    expect(resultado!.aviso).toMatch(/HTTPS/)
  })

  it('navegador sem geolocalização: bloqueado, com mensagem própria', () => {
    expect(impedimentoDoNavegador({ temGeolocalizacao: false, contextoSeguro: true })).toEqual({
      estado: 'bloqueado',
      aviso: 'Este navegador não oferece localização.',
    })
  })

  it('com suporte e HTTPS, nada impede', () => {
    expect(impedimentoDoNavegador({ temGeolocalizacao: true, contextoSeguro: true })).toBeNull()
  })
})

describe('erros do GPS', () => {
  it('cada erro da primeira posição tem estado e mensagem próprios', () => {
    expect(resultadoDoErro(1)).toEqual({ estado: 'bloqueado', aviso: MENSAGENS.negada })
    expect(resultadoDoErro(2)).toEqual({ estado: 'ocioso', aviso: MENSAGENS.indisponivel })
    expect(resultadoDoErro(3)).toEqual({ estado: 'ocioso', aviso: MENSAGENS.tempoEsgotado })
    expect(MENSAGENS.tempoEsgotado).toMatch(/10 segundos/)
    const textos = [MENSAGENS.negada, MENSAGENS.indisponivel, MENSAGENS.tempoEsgotado]
    expect(new Set(textos).size).toBe(3)
  })

  it('acompanhando, só a permissão revogada encerra; perder o sinal mantém o ponto', () => {
    expect(resultadoDoErroAcompanhando(1)).toEqual({ estado: 'bloqueado', aviso: MENSAGENS.negada })
    expect(resultadoDoErroAcompanhando(2)).toEqual({
      estado: 'ativo',
      aviso: MENSAGENS.sinalPerdido,
    })
    expect(resultadoDoErroAcompanhando(3)).toEqual({
      estado: 'ativo',
      aviso: MENSAGENS.sinalPerdido,
    })
  })

  it('pede o GPS do aparelho, com 10 s de prazo, sem nada que dependa de rede', () => {
    expect(OPCOES_DA_PRIMEIRA_POSICAO).toEqual({
      enableHighAccuracy: true,
      timeout: 10_000,
      maximumAge: 10_000,
    })
    expect(OPCOES_DO_ACOMPANHAMENTO.enableHighAccuracy).toBe(true)
  })
})

describe('halo da precisão', () => {
  it('converte metros em pixels no zoom atual (tiles de 512 px do MapLibre)', () => {
    // No equador, zoom 0: o mundo inteiro (40.075 km) em 512 px.
    expect(raioEmPixels(40_075_016.686 / 512, 0, 0)).toBeCloseTo(1, 6)
    // Cada zoom a mais dobra os pixels do mesmo raio.
    expect(raioEmPixels(10, -0.59, 16)).toBeCloseTo(2 * raioEmPixels(10, -0.59, 15), 6)
    // Na ilha, zoom 15: ~2,39 m por pixel → 24 m de precisão ≈ 10 px de raio.
    expect(raioEmPixels(24, -0.59, 15)).toBeCloseTo(10.05, 1)
  })
})
