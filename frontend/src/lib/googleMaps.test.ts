import { describe, expect, it } from 'vitest'
import {
  extrairCoordenadasMapa,
  nomeDoLocalParaMapa,
  urlGoogleMapsAlgodoal,
  urlGoogleMapsLocal,
  urlGoogleMapsRota,
  urlGoogleStreetView,
} from './googleMaps'

describe('googleMaps', () => {
  it('extrai latitude/longitude diretas', () => {
    expect(extrairCoordenadasMapa({ latitude: -0.59219, longitude: -47.58609 })).toEqual({
      latitude: -0.59219,
      longitude: -47.58609,
    })
  })

  it('aceita lat/lng como strings e dados aninhados', () => {
    expect(extrairCoordenadasMapa({ data: { lat: '-0.58', lng: '-47.59' } })).toEqual({
      latitude: -0.58,
      longitude: -47.59,
    })
  })

  it('aceita coordinates no padrão GeoJSON [lng, lat]', () => {
    expect(extrairCoordenadasMapa({ geometry: { coordinates: [-47.58, -0.59] } })).toEqual({
      latitude: -0.59,
      longitude: -47.58,
    })
  })

  it('rejeita coordenadas inválidas', () => {
    expect(extrairCoordenadasMapa({ latitude: 120, longitude: -47 })).toBeNull()
  })

  it('obtém nome direto ou dentro de data', () => {
    expect(nomeDoLocalParaMapa({ name: 'Praia da Princesa' })).toBe('Praia da Princesa')
    expect(nomeDoLocalParaMapa({ data: { nome: 'Lago da Princesa' } })).toBe('Lago da Princesa')
  })

  it('gera URL geral de Algodoal sem chave de API', () => {
    const url = new URL(urlGoogleMapsAlgodoal())
    expect(url.hostname).toBe('www.google.com')
    expect(url.searchParams.get('api')).toBe('1')
    expect(url.searchParams.get('map_action')).toBe('map')
    expect(url.searchParams.get('center')).toBe('-0.59219,-47.58609')
  })

  it('gera busca e rota usando coordenadas quando existem', () => {
    const local = { name: 'Local', latitude: -0.59, longitude: -47.58 }
    expect(new URL(urlGoogleMapsLocal(local)).searchParams.get('query')).toBe('-0.59,-47.58')
    expect(new URL(urlGoogleMapsRota(local)).searchParams.get('destination')).toBe('-0.59,-47.58')
  })

  it('gera Street View apenas quando há coordenadas', () => {
    const street = urlGoogleStreetView({ lat: -0.59, lng: -47.58 })
    expect(street).not.toBeNull()
    const url = new URL(street!)
    expect(url.searchParams.get('map_action')).toBe('pano')
    expect(url.searchParams.get('viewpoint')).toBe('-0.59,-47.58')
    expect(urlGoogleStreetView({ name: 'Sem coordenadas' })).toBeNull()
  })
})
