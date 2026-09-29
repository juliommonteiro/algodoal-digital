import { Card } from '../components/ui/Card'
import { Rotulo } from '../components/ui/Rotulo'

export function PassaportePage() {
  return (
    <section className="page">
      <title>Passaporte · Algodoal Digital</title>
      <h1>Passaporte</h1>
      <p className="page__intro">Check-ins, missões ambientais e conquistas na ilha.</p>
      <Card className="aviso-semana">
        <Rotulo>Em breve · S11</Rotulo>
        <p>Leitura de QR Code, check-ins e progresso chegam na S11, funcionando também offline.</p>
      </Card>
    </section>
  )
}
