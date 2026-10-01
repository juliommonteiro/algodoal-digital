import { Link, NavLink, Navigate, useParams } from 'react-router'
import { useAuth } from '../auth/contexto'
import { FormularioDoLocal } from './FormularioDoLocal'
import { ListaDeLocais } from './ListaDeLocais'
import './admin.css'

/** Seções que ainda não existem; a semana vem do docs/backlog.md. */
const EM_BREVE: [secao: string, quando: string][] = [
  ['Usuários', 'a definir'], // ainda sem item no backlog
  ['Carroceiros', 'S9'],
  ['Missões', 'S10'],
  ['Recompensas', 'S11'],
]

/**
 * Qual tela abrir, pelo resto do caminho depois de /admin/. Feito à mão, e não com <Routes>:
 * o <Routes> traria código do react-router para o bundle principal (onde o roteador mora),
 * e o painel não pode fazer o app do turista crescer.
 */
function Tela() {
  const partes = (useParams()['*'] ?? '').split('/').filter(Boolean)
  if (partes.length === 0 || (partes.length === 1 && partes[0] === 'locais')) {
    return <ListaDeLocais />
  }
  if (partes.length === 2 && partes[0] === 'locais') {
    const id = partes[1] === 'novo' ? null : partes[1]
    return <FormularioDoLocal id={id} />
  }
  return <Navigate to="/admin/locais" replace />
}

/**
 * Painel administrativo (/admin). Carregado sob demanda (routes.tsx) e fora do precache
 * (vite.config.ts): nada daqui vai para o celular do turista.
 */
export default function PainelAdmin() {
  const { usuario } = useAuth()

  return (
    <div className="admin">
      <aside className="admin__lateral" aria-label="Seções do painel">
        <p className="admin__marca">Painel</p>
        <nav>
          <ul className="admin__menu">
            <li>
              {/* Única seção pronta: fica marcada também em /admin e nos formulários. */}
              <NavLink to="/admin/locais" className="admin__item admin__item--ativo">
                Locais
              </NavLink>
            </li>
            {EM_BREVE.map(([secao, quando]) => (
              <li key={secao}>
                <span className="admin__item admin__item--off" aria-disabled="true">
                  {secao}
                  <span className="admin__quando">{quando}</span>
                </span>
              </li>
            ))}
          </ul>
        </nav>
        <div className="admin__rodape">
          {usuario && <p className="admin__quem">{usuario.email}</p>}
          <Link to="/" className="admin__voltar">
            ← Voltar ao app
          </Link>
        </div>
      </aside>

      <main className="admin__conteudo">
        <Tela />
      </main>
    </div>
  )
}
