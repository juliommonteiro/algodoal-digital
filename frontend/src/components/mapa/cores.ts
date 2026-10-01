/**
 * Cores do mapa e dos marcadores. São os valores hex de src/styles/tokens.css (o fallback de
 * cada token) — o MapLibre precisa da cor concreta e não lê variável CSS. O teste
 * cores.test.ts compara com o tokens.css: mudou lá, este arquivo acusa.
 */
export const COR = {
  fundo: '#f1efe6',
  superficie: '#fdfcf7',
  borda: '#dad8cd',
  verde: '#176449',
  verdeFundo: '#004f38',
  terracota: '#a04f27',
  tinta: '#1a211c',
  tinta2: '#353d36',
  suave: '#5d665f',
  areia: '#fdd990',
  mapaAgua: '#cae3ea',
  mapaVegetacao: '#c7e0c1',
  mapaPraia: '#eee4cb',
} as const

/** Nome da variável CSS de cada cor, para o teste de sincronia. */
export const TOKEN_DA_COR: Record<keyof typeof COR, string> = {
  fundo: '--fundo',
  superficie: '--superficie',
  borda: '--borda',
  verde: '--verde',
  verdeFundo: '--verde-fundo',
  terracota: '--terracota',
  tinta: '--tinta',
  tinta2: '--tinta-2',
  suave: '--suave',
  areia: '--areia',
  mapaAgua: '--mapa-agua',
  mapaVegetacao: '--mapa-vegetacao',
  mapaPraia: '--mapa-praia',
}

/**
 * Cor do marcador pela categoria de primeiro nível. Os tokens dão poucos tons bem distintos;
 * o nome e a categoria também vão no aria-label e no card, então a cor nunca é a única pista.
 */
export const COR_DA_CATEGORIA: Record<string, string> = {
  turismo: COR.verde,
  alimentacao: COR.terracota,
  hospedagem: COR.tinta,
  cultura: COR.areia,
  preservacao: COR.verdeFundo,
  servicos: COR.suave,
}
export const COR_SEM_CATEGORIA = COR.suave
