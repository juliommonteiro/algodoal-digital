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
        <div className="topo__inner">
          <Link to="/" className="topo__marca" aria-label="Algodoal Digital — ir para o mapa">
            <span className="topo__simbolo" aria-hidden="true">
              AD
            </span>
            <span className="topo__marca-texto">
              <span className="topo__marca-linha">
                Algodoal <span className="topo__marca-2">Digital</span>
              </span>
              <span className="topo__subtitulo">Ilha de Maiandeua</span>
            </span>
          </Link>

          <nav className="topo__nav" aria-label="Navegação principal desktop">
            {ABAS.map((aba) => (
              <NavLink
                key={aba.to}
                to={aba.to}
                end={aba.end}
                aria-label={`${aba.rotulo} (desktop)`}
                className={({ isActive }) =>
                  isActive ? 'topo__nav-link topo__nav-link--ativo' : 'topo__nav-link'
                }
              >
                <Icone nome={aba.icone} tamanho={18} />
                <span>{aba.rotulo}</span>
              </NavLink>
            ))}
          </nav>

          <div className="topo__acoes">
            {usuario ? (
              <>
                {painel && (
                  <Link to={painel.to} className="topo__link topo__link--painel">
                    {painel.rotulo}
                  </Link>
                )}
                <span className="topo__nome" title={usuario.email}>
                  <span aria-hidden="true">Olá, </span>
                  <span>{usuario.name.split(' ')[0]}</span>
                </span>
                <button type="button" className="topo__link" onClick={sair}>
                  Sair
                </button>
              </>
            ) : (
              <Link to="/entrar" className="topo__link topo__link--entrar">
                Entrar
              </Link>
            )}
          </div>
        </div>
      </header>

      <OfflineBanner />

      <main id="conteudo" className="app-main" tabIndex={-1}>
        <Outlet />
      </main>

      <nav className="tabbar" aria-label="Navegação principal">
        {ABAS.map((aba) => (
          <NavLink
            key={aba.to}
            to={aba.to}
            end={aba.end}
            className={({ isActive }) => (isActive ? 'tab tab--ativo' : 'tab')}
          >
            <Icone nome={aba.icone} />
            <span>{aba.rotulo}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
