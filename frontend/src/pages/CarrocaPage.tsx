import { Card } from '../components/ui/Card'
import { Rotulo } from '../components/ui/Rotulo'

export function CarrocaPage() {
  return (
    <section className="page">
      <title>Carroça · Algodoal Digital</title>
      <h1>Carroça</h1>
      <p className="page__intro">Peça uma carroça informando origem, destino e número de pessoas.</p>
      <Card className="aviso-semana">
        <Rotulo>Em breve · S10</Rotulo>
        <p>O pedido de carroça precisa de internet. Sem rede, o app vai mostrar o WhatsApp dos carroceiros.</p>
      </Card>
    </section>
  )
}
