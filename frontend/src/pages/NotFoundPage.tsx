import { Link } from 'react-router'
import { Icone } from '../components/Icone'
import { EstadoVazio } from '../components/ui/EstadoVazio'

export function NotFoundPage() {
  return (
    <section className="page">
      <title>Página não encontrada · Algodoal Digital</title>
      <EstadoVazio
        nivel="h1"
        icone={<Icone nome="bussola" />}
        titulo="Página não encontrada"
        frase="O endereço pode estar errado ou a página mudou de lugar."
        acao={<Link to="/">Voltar ao mapa</Link>}
      />
    </section>
  )
}
