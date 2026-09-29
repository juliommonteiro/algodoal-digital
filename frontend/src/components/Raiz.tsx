import { Outlet } from 'react-router'
import { AuthProvider } from '../auth/AuthContext'

/** Rota-raiz: a sessão fica disponível para todas as telas, com e sem abas. */
export function Raiz() {
  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  )
}
