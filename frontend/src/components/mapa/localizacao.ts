/**
 * "Onde estou" no mapa: as decisões, sem tocar no navegador nem no MapLibre — testável com
 * números. Quem fala com navigator.geolocation e com o mapa é o BotaoLocalizacao.tsx.
 */
import { dentroDaArea } from '../../lib/areaDoMapa'

/** O que o botão mostra. */
export type EstadoDaLocalizacao = 'ocioso' | 'buscando' | 'ativo' | 'bloqueado'

export const ZOOM_DA_LOCALIZACAO = 15

/**
 * GPS sem rede: enableHighAccuracy true pede o GPS do aparelho, que funciona offline. Com
 * false, o Android prefere a posição por Wi-Fi e antena, que depende de rede para resolver —
 * na ilha sem sinal, não viria. Nenhum fallback por rede, e nenhuma chamada de API.
 */
export const OPCOES_DA_PRIMEIRA_POSICAO: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 10_000,
  // Uma posição de até 10 s atrás ainda é onde a pessoa está, e responde na hora.
  maximumAge: 10_000,
}

/** Acompanhando: sem prazo (o GPS manda quando tiver posição nova). */
export const OPCOES_DO_ACOMPANHAMENTO: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 5_000,
}

export const MENSAGENS = {
  fora: 'Você está fora de Algodoal — o mapa cobre só a ilha.',
  semSuporte: 'Este navegador não oferece localização.',
  semHttps:
    'A localização só funciona em página segura (HTTPS). Abra o app pelo endereço https:// — ' +
    'ou por localhost, no computador.',
  negada:
    'Você não permitiu o acesso à localização. Para usar, libere a localização deste site nas ' +
    'configurações do navegador e toque de novo.',
  tempoEsgotado:
    'O GPS não respondeu em 10 segundos. Vá para um lugar mais aberto e toque de novo.',
  indisponivel:
    'Não foi possível descobrir sua posição. Confira se a localização do celular está ligada e ' +
    'toque de novo.',
  sinalPerdido: 'Sinal do GPS perdido. O ponto azul mostra a última posição conhecida.',
} as const

export interface Resultado {
  estado: EstadoDaLocalizacao
  aviso: string | null
}

/**
 * Antes de pedir a permissão: dá para pedir? Sem suporte ou fora de contexto seguro (página
 * em http num IP de rede — comum no desenvolvimento pelo celular), nem adianta perguntar.
 */
export function impedimentoDoNavegador(ambiente: {
  temGeolocalizacao: boolean
  contextoSeguro: boolean
}): Resultado | null {
  if (!ambiente.contextoSeguro) return { estado: 'bloqueado', aviso: MENSAGENS.semHttps }
  if (!ambiente.temGeolocalizacao) return { estado: 'bloqueado', aviso: MENSAGENS.semSuporte }
  return null
}

// Códigos de GeolocationPositionError (2 é posição indisponível).
const PERMISSAO_NEGADA = 1
const TEMPO_ESGOTADO = 3

/** Erro do GPS na primeira posição: cada caso com a sua mensagem. */
export function resultadoDoErro(codigo: number): Resultado {
  if (codigo === PERMISSAO_NEGADA) return { estado: 'bloqueado', aviso: MENSAGENS.negada }
  if (codigo === TEMPO_ESGOTADO) return { estado: 'ocioso', aviso: MENSAGENS.tempoEsgotado }
  // Posição indisponível (2) e qualquer código que o navegador invente.
  return { estado: 'ocioso', aviso: MENSAGENS.indisponivel }
}

/**
 * Erro enquanto acompanha: permissão revogada encerra; perder o sinal por um tempo, não — o
 * ponto fica na última posição e o aviso explica.
 */
export function resultadoDoErroAcompanhando(codigo: number): Resultado {
  if (codigo === PERMISSAO_NEGADA) return { estado: 'bloqueado', aviso: MENSAGENS.negada }
  return { estado: 'ativo', aviso: MENSAGENS.sinalPerdido }
}

export type DecisaoDaPosicao =
  | { dentro: true; centro: [number, number]; zoom: number; precisao: number }
  | { dentro: false; aviso: string }

/**
 * Para onde levar o mapa. Fora do recorte não centraliza: não há tile lá, e a tela ficaria
 * cinza (a equipe testa de Belém, a 150 km). Na borda exata conta como dentro, a mesma regra
 * dos locais; o maxBounds do mapa ajusta a vista para não mostrar o que fica além.
 */
export function decidirPosicao(coordenadas: {
  longitude: number
  latitude: number
  accuracy: number
}): DecisaoDaPosicao {
  const { longitude, latitude, accuracy } = coordenadas
  if (!dentroDaArea(longitude, latitude)) return { dentro: false, aviso: MENSAGENS.fora }
  return {
    dentro: true,
    centro: [longitude, latitude],
    zoom: ZOOM_DA_LOCALIZACAO,
    precisao: accuracy,
  }
}

/** Circunferência da Terra no equador, em metros (WGS84). */
const CIRCUNFERENCIA = 40_075_016.686
/** O MapLibre usa tiles de 512 px: no zoom 0 o mundo inteiro tem 512 px de largura. */
const TILE = 512

/** Raio de precisão (metros) em pixels, na latitude e no zoom atuais. */
export function raioEmPixels(precisaoEmMetros: number, latitude: number, zoom: number): number {
  const metrosPorPixel =
    (CIRCUNFERENCIA * Math.cos((latitude * Math.PI) / 180)) / (TILE * 2 ** zoom)
  return precisaoEmMetros / metrosPorPixel
}
