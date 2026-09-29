import type { Perfil, Usuario } from '../lib/tipos'

/** Chave no localStorage. Guarda só o refresh token e o usuário; o de acesso fica em memória. */
export const CHAVE_SESSAO = 'algodoal.auth'

export interface SessaoSalva {
  refresh_token: string
  user: Usuario
}

const PERFIS: readonly Perfil[] = ['tourist', 'carrier', 'partner', 'admin']

function ehUsuario(valor: unknown): valor is Usuario {
  if (!valor || typeof valor !== 'object') return false
  const u = valor as Record<string, unknown>
  return (
    typeof u.id === 'string' &&
    typeof u.name === 'string' &&
    typeof u.email === 'string' &&
    PERFIS.includes(u.role as Perfil)
  )
}

/** Lê a sessão salva. Qualquer coisa estranha (JSON quebrado, formato antigo) vira "sem sessão". */
export function lerSessao(): SessaoSalva | null {
  try {
    const bruto = localStorage.getItem(CHAVE_SESSAO)
    if (!bruto) return null
    const dado: unknown = JSON.parse(bruto)
    if (
      dado &&
      typeof dado === 'object' &&
      typeof (dado as SessaoSalva).refresh_token === 'string' &&
      ehUsuario((dado as SessaoSalva).user)
    ) {
      return dado as SessaoSalva
    }
  } catch {
    // localStorage bloqueado (aba anônima de alguns navegadores) ou JSON inválido
  }
  return null
}

export function gravarSessao(sessao: SessaoSalva): void {
  try {
    localStorage.setItem(CHAVE_SESSAO, JSON.stringify(sessao))
  } catch {
    // Sem localStorage a sessão dura só enquanto a aba estiver aberta.
  }
}

export function apagarSessao(): void {
  try {
    localStorage.removeItem(CHAVE_SESSAO)
  } catch {
    // idem
  }
}
