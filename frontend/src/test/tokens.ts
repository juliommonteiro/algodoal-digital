/**
 * Lê src/styles/tokens.css como texto, para os testes de cor. O primeiro bloco :root tem o
 * fallback de cada token: um hex, ou um apelido var(--outro) para uma cor que já existe.
 */
import tokensCss from '../styles/tokens.css?raw'

const raiz = tokensCss.slice(tokensCss.indexOf(':root {'), tokensCss.indexOf('}'))

/** Tokens com hex próprio. */
export const hexProprio = new Map(
  [...raiz.matchAll(/(--[a-z0-9-]+):\s*(#[0-9a-f]{6});/gi)].map(([, nome, hex]) => [
    nome,
    hex.toLowerCase(),
  ]),
)

/** Tokens que são apelido de outro (var). */
export const apelidos = new Map(
  [...raiz.matchAll(/(--[a-z0-9-]+):\s*var\((--[a-z0-9-]+)\);/gi)].map(([, nome, alvo]) => [
    nome,
    alvo,
  ]),
)

/** Hex de um token, seguindo os apelidos. */
export function hexDoToken(token: string): string | undefined {
  return (
    hexProprio.get(token) ?? (apelidos.has(token) ? hexDoToken(apelidos.get(token)!) : undefined)
  )
}

/** O bloco @supports, com as versões em OKLCH. */
export const blocoOklch = tokensCss.slice(tokensCss.indexOf('@supports ('))

/** Contraste WCAG 2 entre duas cores em hex. */
export function contraste(a: string, b: string): number {
  const luminancia = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl
  }
  const [claro, escuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x)
  return (claro + 0.05) / (escuro + 0.05)
}
