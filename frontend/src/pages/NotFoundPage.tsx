import { Link } from 'react-router'

export function NotFoundPage() {
  return (
    <section className="page">
      <h1>Página não encontrada</h1>
      <p>
        <Link to="/">Voltar ao mapa</Link>
      </p>
    </section>
  )
}
