import { Card } from '../components/ui/Card'
import { Rotulo } from '../components/ui/Rotulo'
import { useOnlineStatus } from '../lib/useOnlineStatus'

export function CarrocaPage() {
  const online = useOnlineStatus()

  return (
    <section className="page page--feature" aria-labelledby="titulo-carroca">
      <title>Carroça · Algodoal Digital</title>

      <header className="page__heading feature-hero feature-hero--carroca">
        <div>
          <p className="page__eyebrow">Transporte local</p>
          <h1 id="titulo-carroca">Peça uma carroça sem complicação</h1>
          <p className="page__intro">
            Informe onde você está, para onde quer ir e quantas pessoas vão viajar.
          </p>
        </div>
        <span className={online ? 'availability availability--online' : 'availability availability--offline'}>
          <span aria-hidden="true" />
          {online ? 'Conexão disponível' : 'Sem conexão'}
        </span>
      </header>

      <div className="feature-grid">
        <Card as="section" className="feature-card feature-card--primary" aria-labelledby="titulo-fluxo-carroca">
          <Rotulo as="h2" id="titulo-fluxo-carroca">
            Como vai funcionar
          </Rotulo>
          <ol className="step-list">
            <li>
              <span className="step-list__number">1</span>
              <div>
                <strong>Informe sua origem</strong>
                <p>Escolha um ponto conhecido ou descreva onde você está.</p>
              </div>
            </li>
            <li>
              <span className="step-list__number">2</span>
              <div>
                <strong>Escolha o destino</strong>
                <p>Praia, pousada, restaurante ou outro ponto da ilha.</p>
              </div>
            </li>
            <li>
              <span className="step-list__number">3</span>
              <div>
                <strong>Aguarde a confirmação</strong>
                <p>Um carroceiro disponível poderá aceitar sua solicitação.</p>
              </div>
            </li>
          </ol>
        </Card>

        <Card as="aside" className="feature-card feature-card--status" aria-labelledby="titulo-status-carroca">
          <Rotulo as="h2" id="titulo-status-carroca">
            Disponibilidade
          </Rotulo>
          {online ? (
            <>
              <p className="feature-card__title">Você está conectado.</p>
              <p>
                A solicitação online será habilitada na próxima etapa do módulo de transporte.
              </p>
            </>
          ) : (
            <>
              <p className="feature-card__title">Solicitações exigem conexão.</p>
              <p>
                O conteúdo da ilha continua disponível offline, mas um pedido de transporte precisa chegar ao servidor em tempo real.
              </p>
            </>
          )}
          <div className="feature-note">
            <strong>Por que isso importa?</strong>
            <span>Não enviaremos pedidos antigos automaticamente quando a internet voltar.</span>
          </div>
        </Card>
      </div>
    </section>
  )
}
