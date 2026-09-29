/** Rotas que não fazem sentido como destino depois do login. */
const ROTAS_DE_ACESSO = ['/entrar', '/criar-conta']

/**
 * Para onde voltar depois de entrar: a rota guardada pela RotaProtegida em `state.de`.
 * Só aceita caminho interno ("/algo"), nunca "//outro-site" nem URL absoluta.
 */
export function destinoAposLogin(state: unknown, padrao = '/'): string {
  const de = (state as { de?: unknown } | null)?.de
  if (
    typeof de === 'string' &&
    de.startsWith('/') &&
    !de.startsWith('//') &&
    !ROTAS_DE_ACESSO.some((rota) => de === rota || de.startsWith(`${rota}?`))
  ) {
    return de
  }
  return padrao
}
