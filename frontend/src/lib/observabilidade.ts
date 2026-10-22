export type NivelLog = 'INFO' | 'WARN' | 'ERROR'
export type ContextoLog = Record<string, string | number | boolean | null | undefined>

function serializarErro(erro: unknown): string {
  if (erro instanceof Error) return erro.message
  if (typeof erro === 'string') return erro
  return 'erro_desconhecido'
}

/**
 * Log estruturado de cliente. Nunca envie tokens, senhas ou payloads de usuário no contexto.
 */
export function logEstruturado(
  nivel: NivelLog,
  evento: string,
  contexto: ContextoLog = {},
  erro?: unknown,
): void {
  const entrada = JSON.stringify({
    timestamp: new Date().toISOString(),
    level: nivel,
    event: evento,
    ...contexto,
    ...(erro === undefined ? {} : { error: serializarErro(erro) }),
  })

  if (nivel === 'ERROR') {
    console.error(entrada)
    return
  }
  if (nivel === 'WARN') {
    console.warn(entrada)
    return
  }
  console.info(entrada)
}
