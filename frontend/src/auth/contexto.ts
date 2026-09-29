import { createContext, useContext } from 'react'
import type { Usuario } from '../lib/tipos'

export interface ValorAuth {
  /** Usuário da sessão local; existe mesmo offline, sem ter falado com o servidor. */
  usuario: Usuario | null
  /** true enquanto um entrar/registrar está em andamento. A renovação em segundo plano não conta. */
  carregando: boolean
  entrar(email: string, senha: string): Promise<Usuario>
  registrar(nome: string, email: string, senha: string): Promise<Usuario>
  sair(): void
}

export const AuthContexto = createContext<ValorAuth | null>(null)

export function useAuth(): ValorAuth {
  const valor = useContext(AuthContexto)
  if (!valor) throw new Error('useAuth precisa estar dentro de <AuthProvider>')
  return valor
}
