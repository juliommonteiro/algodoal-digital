import { Card } from '../components/ui/Card'
import { Rotulo } from '../components/ui/Rotulo'

const CONQUISTAS = [
  { titulo: 'Explorador das praias', descricao: 'Visite diferentes praias da ilha.', sigla: 'PR' },
  { titulo: 'Guardião de Algodoal', descricao: 'Participe de missões ambientais.', sigla: 'GA' },
  { titulo: 'Caminhante da ilha', descricao: 'Descubra trilhas e pontos turísticos.', sigla: 'CI' },
]

export function PassaportePage() {
  return (
    <section className="page page--feature" aria-labelledby="titulo-passaporte">
      <title>Passaporte · Algodoal Digital</title>

      <header className="page__heading feature-hero feature-hero--passaporte">
        <div>
          <p className="page__eyebrow">Sua jornada</p>
          <h1 id="titulo-passaporte" aria-label="Passaporte">Passaporte Algodoal</h1>
          <p className="page__intro">
            Registre descobertas, conclua missões ambientais e acompanhe sua evolução pela ilha.
          </p>
        </div>
        <div className="passport-mark" aria-hidden="true">
          AD
        </div>
      </header>

      <div className="feature-grid feature-grid--passport">
        <Card as="section" className="passport-card" aria-labelledby="titulo-progresso">
          <div className="passport-card__top">
            <Rotulo as="h2" id="titulo-progresso">
              Progresso
            </Rotulo>
            <span className="passport-card__percent">0%</span>
          </div>
          <div className="progress-track" aria-label="Progresso do passaporte: 0%">
            <span style={{ width: '0%' }} />
          </div>
          <div className="passport-stats" aria-label="Resumo do passaporte">
            <div>
              <strong>0</strong>
              <span>locais</span>
            </div>
            <div>
              <strong>0</strong>
              <span>missões</span>
            </div>
            <div>
              <strong>0</strong>
              <span>pontos</span>
            </div>
          </div>
          <p className="passport-card__hint">
            O progresso será ativado junto com check-ins, missões e validação por QR Code.
          </p>
        </Card>

        <Card as="section" className="feature-card" aria-labelledby="titulo-conquistas">
          <Rotulo as="h2" id="titulo-conquistas">
            Conquistas
          </Rotulo>
          <div className="achievement-list">
            {CONQUISTAS.map((conquista) => (
              <article key={conquista.titulo} className="achievement achievement--locked">
                <span className="achievement__icon" aria-hidden="true">
                  {conquista.sigla}
                </span>
                <div>
                  <strong>{conquista.titulo}</strong>
                  <p>{conquista.descricao}</p>
                </div>
                <span className="achievement__status">Bloqueada</span>
              </article>
            ))}
          </div>
        </Card>
      </div>
    </section>
  )
}
