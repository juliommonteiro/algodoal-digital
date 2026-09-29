import { EstadoVazio } from '../components/ui/EstadoVazio'

export interface EmBrevePageProps {
  titulo: string
  frase: string
}

/** Placeholder das áreas por perfil (carroceiro, parceiro, admin). */
export function EmBrevePage({ titulo, frase }: EmBrevePageProps) {
  return (
    <section className="page">
      <title>{`${titulo} · Algodoal Digital`}</title>
      <EstadoVazio nivel="h1" titulo={titulo} frase={frase} />
    </section>
  )
}
