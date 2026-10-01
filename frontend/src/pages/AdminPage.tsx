import { lazy, Suspense } from 'react'
import { Link } from 'react-router'
import { Carregando } from '../components/ui/Carregando'
import { classesBotao } from '../components/ui/classes'
import { EstadoVazio } from '../components/ui/EstadoVazio'

// Chunk próprio, fora do precache (vite.config.ts): o código do painel não vai para o celular
// do turista. Só quem abre /admin, com rede, baixa.
const PainelAdmin = lazy(() => import('../admin/PainelAdmin'))

export function AdminPage() {
  return (
    <Suspense
      fallback={
        <div className="page">
          <Carregando rotulo="Abrindo o painel…" />
        </div>
      }
    >
      <PainelAdmin />
    </Suspense>
  )
}

/** O painel não fica guardado no aparelho: sem rede, o código dele não carrega. */
export function AdminIndisponivel() {
  return (
    <section className="page">
      <EstadoVazio
        nivel="h1"
        titulo="O painel não abriu"
        frase="O painel administrativo precisa de internet e não fica guardado no aparelho. Confira a conexão e tente de novo."
        acao={
          <Link to="/" className={classesBotao('secundario')}>
            Voltar ao mapa
          </Link>
        }
      />
    </section>
  )
}
