import type { ReactNode } from 'react'
import { Link, Navigate, Outlet, useLocation } from 'react-router'
import { EstadoVazio } from '../components/ui/EstadoVazio'
import type { Perfil } from '../lib/tipos'
import { useAuth } from './contexto'
import { classesBotao } from '../components/ui/classes'

export interface RotaProtegidaProps {
  /** Se informado, só esses perfis entram. Sem a prop, basta estar autenticado. */
  perfis?: Perfil[]
  children?: ReactNode
}

/**
 * Sem sessão: manda para /entrar guardando a rota pretendida em `state.de`.
 * Com sessão mas perfil errado: mostra "área restrita" (mandar para o login não resolveria).
 * Use como elemento de rota-pai (renderiza <Outlet />) ou envolvendo a tela.
 */
export function RotaProtegida({ perfis, children }: RotaProtegidaProps) {
  const { usuario } = useAuth()
  const local = useLocation()

  if (!usuario) {
    const de = `${local.pathname}${local.search}${local.hash}`
    return <Navigate to="/entrar" replace state={{ de }} />
  }

  if (perfis && !perfis.includes(usuario.role)) {
    return (
      <section className="page">
        <EstadoVazio
          nivel="h1"
          titulo="Área restrita"
          frase="Esta área é de outro perfil de usuário. Se você acha que deveria ter acesso, fale com a equipe do Algodoal Digital."
          acao={
            <Link to="/" className={classesBotao('secundario')}>
              Voltar ao mapa
            </Link>
          }
        />
      </section>
    )
  }

  return children ?? <Outlet />
}
