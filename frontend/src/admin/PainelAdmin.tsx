import { Link, Navigate, useParams } from 'react-router'
import { useAuth } from '../auth/contexto'
import { Carroceiros } from './Carroceiros'
import { FormularioDoLocal } from './FormularioDoLocal'
import { Indicadores } from './Indicadores'
import { ListaDeLocais } from './ListaDeLocais'
import { Usuarios } from './Usuarios'
import './admin.css'

/** Seções do painel, na ordem da barra lateral. Missões e recompensas entram com o passaporte. */
const SECOES: [caminho: string, rotulo: string][] = [
  ['indicadores', 'Indicadores'],
  ['locais', 'Locais'],
  ['usuarios', 'Usuários'],
  ['carroceiros', 'Carroceiros'],
]

/**
 * Qual tela abrir, pelo resto do caminho depois de /admin/. Feito à mão, e não com <Routes>:
 * o <Routes> traria código do react-router para o bundle principal (onde o roteador mora),
 * e o painel não pode fazer o app do turista crescer.
 */
function useSecao(): string[] {
  return (useParams()['*'] ?? '').split('/').filter(Boolean)
}

function Tela() {
  const partes = useSecao()
  if (partes.length === 1 && partes[0] === 'indicadores') return <Indicadores />
  if (partes.length === 1 && partes[0] === 'usuarios') return <Usuarios />
  if (partes.length === 1 && partes[0] === 'carroceiros') return <Carroceiros />
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
  const [secao = 'locais'] = useSecao()
  const classe = (nome: string) =>
    secao === nome ? 'admin__item admin__item--ativo' : 'admin__item'

  return (
    <div className="admin">
      <aside className="admin__lateral" aria-label="Seções do painel">
        <p className="admin__marca">Painel</p>
        <nav>
          <ul className="admin__menu">
            {/* Link, e não NavLink: o NavLink tiraria o aria-current em /admin, que também é Locais. */}
            {SECOES.map(([caminho, rotulo]) => (
              <li key={caminho}>
                <Link
                  to={`/admin/${caminho}`}
                  className={classe(caminho)}
                  aria-current={secao === caminho ? 'page' : undefined}
                >
                  {rotulo}
                </Link>
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
