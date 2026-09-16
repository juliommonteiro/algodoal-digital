import { NavLink, Outlet } from 'react-router'
import { OfflineBanner } from './OfflineBanner'

const tabs = [
  { to: '/', label: 'Mapa', end: true },
  { to: '/diretorio', label: 'Diretório' },
  { to: '/carroca', label: 'Carroça' },
  { to: '/passaporte', label: 'Passaporte' },
]

export function Layout() {
  return (
    <div className="app">
      <OfflineBanner />
      <main className="app-main">
        <Outlet />
      </main>
      <nav className="tabbar" aria-label="Navegação principal">
        {tabs.map((tab) => (
          <NavLink key={tab.to} to={tab.to} end={tab.end} className="tab">
            {tab.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
