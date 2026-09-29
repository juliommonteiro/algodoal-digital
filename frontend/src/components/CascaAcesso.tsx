import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { classesBotao } from './ui/classes'

/** Fundo verde das telas públicas sem abas (/entrar e /criar-conta). */
export function CascaAcesso({ children }: { children: ReactNode }) {
  return (
    <div className="acesso">
      <div className="acesso__coluna">
        <header className="acesso__marca">
          <img src="/favicon.svg" alt="" width={56} height={56} />
          <p className="acesso__nome">Algodoal Digital</p>
          <p className="acesso__slogan">Mapa, serviços locais e passaporte da ilha de Maiandeua.</p>
        </header>

        <main>{children}</main>

        <Link to="/" className={classesBotao('secundario', 'botao--largo botao--sobre-escuro')}>
          Continuar sem conta
        </Link>

        <footer className="acesso__rodape">
          Consultar o mapa e os estabelecimentos não exige conta. A conta serve para pedir
          carroça e juntar pontos no passaporte.
        </footer>
      </div>
    </div>
  )
}
