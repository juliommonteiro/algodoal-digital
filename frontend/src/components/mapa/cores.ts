/**
 * Espelho de tokens para o estilo do MapLibre — a única cópia de hex fora de
 * src/styles/tokens.css, e de propósito: o estilo do MapLibre é JSON, montado em estilo.ts, e
 * não lê variável CSS. Só entram aqui as cores que o estilo usa. Mudou no tokens.css, mude
 * aqui também: o teste cores.test.ts compara um com o outro e acusa a diferença.
 *
 * O resto do app (pinos, legenda, telas) pinta com var(--token) no CSS, sem hex em TypeScript.
 */
export const COR = {
  fundo: '#f1efe6',
  superficie: '#fdfcf7',
  borda: '#dad8cd',
  mapaAgua: '#cae3ea',
  mapaVegetacao: '#c7e0c1',
  mapaPraia: '#eee4cb',
} as const

/** Nome da variável CSS de cada cor, para o teste de sincronia. */
export const TOKEN_DA_COR: Record<keyof typeof COR, string> = {
  fundo: '--fundo',
  superficie: '--superficie',
  borda: '--borda',
  mapaAgua: '--mapa-agua',
  mapaVegetacao: '--mapa-vegetacao',
  mapaPraia: '--mapa-praia',
}

/** Grupos dos tipos de local no mapa (quais tipos em cada um: icones.tsx). */
export type GrupoDoTipo = 'explorar' | 'economia' | 'ambiental' | 'cultura'

/**
 * Classe que pinta o pino do grupo — no marcador e na legenda. A cor fica no mapa.css
 * (.pino--explorar { background-color: var(--mar) } …), não aqui.
 */
export function classeDoGrupo(grupo: GrupoDoTipo): string {
  return `pino--${grupo}`
}
