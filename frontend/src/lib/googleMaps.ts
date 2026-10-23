export interface CoordenadasMapa {
  latitude: number
  longitude: number
}

type Registro = Record<string, unknown>

const CENTRO_ALGODOAL: CoordenadasMapa = {
  latitude: -0.59219,
  longitude: -47.58609,
}

function ehRegistro(valor: unknown): valor is Registro {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

function numeroFinito(valor: unknown): number | null {
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null
  if (typeof valor !== 'string' || valor.trim() === '') return null
  const numero = Number(valor.replace(',', '.'))
  return Number.isFinite(numero) ? numero : null
}

function coordenadasValidas(latitude: number, longitude: number): boolean {
  return latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180
}

function coordenadasDoRegistro(registro: Registro): CoordenadasMapa | null {
  const latitude =
    numeroFinito(registro.latitude) ??
    numeroFinito(registro.lat) ??
    numeroFinito(registro.y)
  const longitude =
    numeroFinito(registro.longitude) ??
    numeroFinito(registro.lng) ??
    numeroFinito(registro.lon) ??
    numeroFinito(registro.long) ??
    numeroFinito(registro.x)

  if (latitude !== null && longitude !== null && coordenadasValidas(latitude, longitude)) {
    return { latitude, longitude }
  }

  const coordinates = registro.coordinates
  if (Array.isArray(coordinates) && coordinates.length >= 2) {
    const lng = numeroFinito(coordinates[0])
    const lat = numeroFinito(coordinates[1])
    if (lat !== null && lng !== null && coordenadasValidas(lat, lng)) {
      return { latitude: lat, longitude: lng }
    }
  }

  return null
}

/**
 * Extrai coordenadas sem acoplar o Google Maps ao formato interno do catálogo.
 * Aceita o formato atual e também formatos comuns usados em migrações/API.
 */
export function extrairCoordenadasMapa(valor: unknown): CoordenadasMapa | null {
  if (!ehRegistro(valor)) return null

  const candidatos: unknown[] = [
    valor,
    valor.data,
    valor.location,
    valor.localizacao,
    valor.coordenadas,
    valor.geometry,
  ]

  for (const candidato of candidatos) {
    if (!ehRegistro(candidato)) continue
    const coordenadas = coordenadasDoRegistro(candidato)
    if (coordenadas) return coordenadas
  }

  return null
}

export function nomeDoLocalParaMapa(valor: unknown): string | null {
  if (!ehRegistro(valor)) return null
  const candidatos = [valor.name, valor.nome]
  for (const candidato of candidatos) {
    if (typeof candidato === 'string' && candidato.trim() !== '') return candidato.trim()
  }

  if (ehRegistro(valor.data)) {
    const nome = valor.data.name ?? valor.data.nome
    if (typeof nome === 'string' && nome.trim() !== '') return nome.trim()
  }

  return null
}

function coordenadasComoTexto(coordenadas: CoordenadasMapa): string {
  return `${coordenadas.latitude},${coordenadas.longitude}`
}

function queryDoLocal(valor: unknown): string {
  const coordenadas = extrairCoordenadasMapa(valor)
  if (coordenadas) return coordenadasComoTexto(coordenadas)

  const nome = nomeDoLocalParaMapa(valor)
  return nome ? `${nome}, Algodoal, Maracanã, Pará, Brasil` : 'Algodoal, Maracanã, Pará, Brasil'
}

export function urlGoogleMapsAlgodoal(): string {
  const url = new URL('https://www.google.com/maps/@')
  url.searchParams.set('api', '1')
  url.searchParams.set('map_action', 'map')
  url.searchParams.set('center', coordenadasComoTexto(CENTRO_ALGODOAL))
  url.searchParams.set('zoom', '14')
  url.searchParams.set('basemap', 'roadmap')
  return url.toString()
}

export function urlGoogleMapsLocal(valor: unknown): string {
  const url = new URL('https://www.google.com/maps/search/')
  url.searchParams.set('api', '1')
  url.searchParams.set('query', queryDoLocal(valor))
  return url.toString()
}

export function urlGoogleMapsRota(valor: unknown): string {
  const url = new URL('https://www.google.com/maps/dir/')
  url.searchParams.set('api', '1')
  url.searchParams.set('destination', queryDoLocal(valor))
  return url.toString()
}

/** Retorna null quando não há coordenadas: Street View exige viewpoint ou pano id. */
export function urlGoogleStreetView(valor: unknown): string | null {
  const coordenadas = extrairCoordenadasMapa(valor)
  if (!coordenadas) return null

  const url = new URL('https://www.google.com/maps/@')
  url.searchParams.set('api', '1')
  url.searchParams.set('map_action', 'pano')
  url.searchParams.set('viewpoint', coordenadasComoTexto(coordenadas))
  return url.toString()
}
