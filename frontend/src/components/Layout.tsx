import { Link, NavLink, Outlet } from 'react-router'
import { useAuth } from '../auth/contexto'
import type { Perfil } from '../lib/tipos'
import { Icone, type NomeIcone } from './Icone'
import { OfflineBanner } from './OfflineBanner'

const ABAS: { to: string; rotulo: string; icone: NomeIcone; end?: boolean }[] = [
  { to: '/', rotulo: 'Mapa', icone: 'mapa', end: true },
  { to: '/diretorio', rotulo: 'Diretório', icone: 'diretorio' },
  { to: '/carroca', rotulo: 'Carroça', icone: 'carroca' },
  { to: '/passaporte', rotulo: 'Passaporte', icone: 'passaporte' },
]

const PAINEL: Partial<Record<Perfil, { to: string; rotulo: string }>> = {
  carrier: { to: '/carroceiro', rotulo: 'Painel' },
  partner: { to: '/parceiro', rotulo: 'Painel' },
  admin: { to: '/admin', rotulo: 'Admin' },
}

export function Layout() {
  const { usuario, sair } = useAuth()
  const painel = usuario ? PAINEL[usuario.role] : undefined

  return (
    <div className="app">
      <a className="pular" href="#conteudo">
        Pular para o conteúdo
      </a>
      <header className="topo">
        <Link to="/" className="topo__marca">
          Algodoal <span className="topo__marca-2">Digital</span>
        </Link>
        <div className="topo__acoes">
          {usuario ? (
            <>
              {painel && (
                <Link to={painel.to} className="topo__link">
                  {painel.rotulo}
                </Link>
              )}
              <span className="topo__nome" title={usuario.email}>
                {usuario.name.split(' ')[0]}
              </span>
              <button type="button" className="topo__link" onClick={sair}>
                Sair
              </button>
            </>
          ) : (
            <Link to="/entrar" className="topo__link">
              Entrar
            </Link>
          )}
        </div>
      </header>
      <OfflineBanner />
      <main id="conteudo" className="app-main" tabIndex={-1}>
        <Outlet />
      </main>
      <nav className="tabbar" aria-label="Navegação principal">
        {ABAS.map((aba) => (
          <NavLink key={aba.to} to={aba.to} end={aba.end} className="tab">
            <Icone nome={aba.icone} />
            <span>{aba.rotulo}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
