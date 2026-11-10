import { FalhaCarga } from '../components/FalhaCarga'
import { Botao } from '../components/ui/Botao'
import { Carregando } from '../components/ui/Carregando'
import type { Indicadores as Dados, StatusPedido } from '../lib/tipos'
import { useCarregar } from '../lib/useCarregar'
import { apiAdmin } from './cliente'

const numero = new Intl.NumberFormat('pt-BR')
const porcento = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 0 })
const hora = new Intl.DateTimeFormat('pt-BR', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'America/Belem',
})

// Texto sempre junto da cor: o status nunca é só a cor do selo.
const STATUS: Record<StatusPedido, { rotulo: string; classe: string }> = {
  pending: { rotulo: 'Aguardando', classe: 'rascunho' },
  accepted: { rotulo: 'Aceita', classe: 'publicado' },
  declined: { rotulo: 'Recusada', classe: 'removido' },
  cancelled: { rotulo: 'Cancelada', classe: 'removido' },
  expired: { rotulo: 'Venceu', classe: 'removido' },
}

/** "1 parceiro", "3 parceiros". */
function qtd(n: number, um: string, varios: string): string {
  return `${numero.format(n)} ${n === 1 ? um : varios}`
}

interface Bloco {
  valor: string
  rotulo: string
  detalhe?: string
}

function blocos(d: Dados): Bloco[] {
  const { usuarios, locais, carroceiros, pedidos } = d
  return [
    {
      valor: numero.format(usuarios.total),
      rotulo: 'usuários cadastrados',
      detalhe: `${qtd(usuarios.turistas, 'turista', 'turistas')} · ${qtd(usuarios.parceiros, 'parceiro', 'parceiros')}`,
    },
    {
      valor: numero.format(usuarios.ativos_30_dias),
      rotulo: 'usuários ativos',
      detalhe: 'entraram nos últimos 30 dias',
    },
    {
      valor: numero.format(locais.estabelecimentos),
      rotulo: 'estabelecimentos',
      detalhe: `${numero.format(locais.estabelecimentos_com_dono)} com dono no painel`,
    },
    {
      valor: numero.format(carroceiros.total),
      rotulo: 'carroceiros',
      detalhe: `${qtd(carroceiros.disponiveis, 'disponível', 'disponíveis')} agora`,
    },
    {
      valor: numero.format(pedidos.total),
      rotulo: 'solicitações de carroça',
      detalhe: `${numero.format(pedidos.ultimos_7_dias)} nos últimos 7 dias`,
    },
    {
      valor: pedidos.taxa_de_aceite_7_dias === null ? '—' : porcento.format(pedidos.taxa_de_aceite_7_dias),
      rotulo: 'aceitas na semana',
      detalhe:
        pedidos.minutos_ate_aceite_7_dias === null
          ? 'sem pedidos respondidos na semana'
          : `em média ${numero.format(pedidos.minutos_ate_aceite_7_dias)} min até o aceite`,
    },
    {
      valor: numero.format(locais.publicados),
      rotulo: 'locais no mapa',
      detalhe: `${qtd(locais.rascunhos, 'rascunho', 'rascunhos')} · ${numero.format(locais.com_foto)} com foto`,
    },
  ]
}

// PRD §18: os três de gamificação entram com o passaporte (última prioridade do cronograma).
const DO_PASSAPORTE = ['missões realizadas', 'pontos distribuídos', 'ações ambientais']

/** Indicadores do piloto (protótipo 13, PRD §18). */
export function Indicadores() {
  const carga = useCarregar('admin:indicadores', () => apiAdmin.indicadores())

  return (
    <section aria-labelledby="titulo-indicadores">
      <title>Indicadores · Painel · Algodoal Digital</title>
      <header className="admin__cabecalho">
        <div>
          <h1 id="titulo-indicadores">Indicadores do piloto</h1>
          <p className="admin__intro">
            Os indicadores do PRD (§18), calculados agora a partir do banco.
            {carga.status === 'ok' && ` Atualizado às ${hora.format(new Date(carga.dados.gerado_em))}.`}
          </p>
        </div>
        <Botao variante="secundario" onClick={carga.recarregar}>
          Atualizar
        </Botao>
      </header>

      {carga.status === 'carregando' && <Carregando rotulo="Calculando os indicadores…" />}
      {carga.status === 'erro' && <FalhaCarga erro={carga.erro} aoTentar={carga.recarregar} />}
      {carga.status === 'ok' && (
        <>
          <ul className="admin-indicadores" aria-label="Indicadores">
            {blocos(carga.dados).map((bloco) => (
              <li key={bloco.rotulo} className="admin-indicador">
                <span className="admin-indicador__valor">{bloco.valor}</span>
                <span className="admin-indicador__rotulo">{bloco.rotulo}</span>
                {bloco.detalhe && <span className="admin-indicador__detalhe">{bloco.detalhe}</span>}
              </li>
            ))}
            {DO_PASSAPORTE.map((rotulo) => (
              <li key={rotulo} className="admin-indicador admin-indicador--depois">
                <span className="admin-indicador__valor" aria-hidden="true">
                  —
                </span>
                <span className="admin-indicador__rotulo">{rotulo}</span>
                <span className="admin-indicador__detalhe">chega com o passaporte</span>
              </li>
            ))}
          </ul>

          <section className="admin-bloco" aria-labelledby="titulo-hoje">
            <h2 id="titulo-hoje">Solicitações de carroça · hoje</h2>
            {carga.dados.pedidos_de_hoje.length === 0 ? (
              <p className="admin__intro">Nenhuma solicitação hoje.</p>
            ) : (
              <ul className="admin-pedidos">
                {carga.dados.pedidos_de_hoje.map((pedido) => (
                  <li key={pedido.id}>
                    <span>
                      {pedido.origin} → {pedido.destination}
                      <span className="admin-pedidos__detalhe">
                        {' · '}
                        {pedido.passengers} {pedido.passengers === 1 ? 'pessoa' : 'pessoas'} ·{' '}
                        {hora.format(new Date(pedido.created_at))}
                      </span>
                    </span>
                    <span className={`admin-status admin-status--${STATUS[pedido.status].classe}`}>
                      {STATUS[pedido.status].rotulo}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="admin-bloco admin-bloco--depois" aria-labelledby="titulo-acoes">
            <h2 id="titulo-acoes">Ações ambientais aguardando validação</h2>
            <p className="admin__intro">
              A validação de ações ambientais entra junto com missões e passaporte.
            </p>
          </section>
        </>
      )}
    </section>
  )
}
