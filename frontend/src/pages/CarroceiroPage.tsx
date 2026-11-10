import { useCallback, useEffect, useState } from 'react'
import { Icone } from '../components/Icone'
import { Botao } from '../components/ui/Botao'
import { Card } from '../components/ui/Card'
import { Carregando } from '../components/ui/Carregando'
import { classesBotao } from '../components/ui/classes'
import { EstadoVazio } from '../components/ui/EstadoVazio'
import { Rotulo } from '../components/ui/Rotulo'
import { ErroApi } from '../lib/api'
import { carroca, INTERVALO_DE_ATUALIZACAO_MS } from '../lib/carroca'
import { linkWhatsAppComTexto } from '../lib/formatos'
import type { PedidoParaCarroceiro, PerfilCarroceiro } from '../lib/tipos'
import { useOnlineStatus } from '../lib/useOnlineStatus'
import { useRepetir } from '../lib/useRepetir'

type Estado =
  | { fase: 'carregando' }
  | { fase: 'erro'; mensagem: string }
  | {
      fase: 'pronto'
      perfil: PerfilCarroceiro
      abertos: PedidoParaCarroceiro[]
      viagens: PedidoParaCarroceiro[]
    }

function mensagemDe(erro: unknown, padrao: string): string {
  return erro instanceof ErroApi ? erro.mensagem : padrao
}

const DIA_E_HORA = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

function hora(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(
    new Date(iso),
  )
}

/** Painel do carroceiro (protótipo 07): disponibilidade, pedidos novos e a semana. */
export function CarroceiroPage() {
  const online = useOnlineStatus()
  const [estado, setEstado] = useState<Estado>({ fase: 'carregando' })
  const [aviso, setAviso] = useState<string | null>(null)
  const [emAndamento, setEmAndamento] = useState<string | null>(null)

  const carregar = useCallback(
    () =>
      Promise.all([carroca.meuPerfil(), carroca.pedidosAbertos(), carroca.viagens()]).then(
        ([perfil, abertos, viagens]) => setEstado({ fase: 'pronto', perfil, abertos, viagens }),
        (erro: unknown) =>
          setEstado((atual) =>
            // Uma falha na atualização automática não apaga o que já está na tela.
            atual.fase === 'pronto'
              ? atual
              : { fase: 'erro', mensagem: mensagemDe(erro, 'Não foi possível carregar o painel.') },
          ),
      ),
    [],
  )

  useEffect(() => {
    if (online) carregar()
  }, [online, carregar])

  const pronto = estado.fase === 'pronto' ? estado : null
  useRepetir(() => void carregar(), INTERVALO_DE_ATUALIZACAO_MS, Boolean(pronto?.perfil.is_available))

  async function alternarDisponivel() {
    if (!pronto) return
    setEmAndamento('disponibilidade')
    setAviso(null)
    try {
      const perfil = await carroca.atualizarPerfil({ is_available: !pronto.perfil.is_available })
      setEstado({ ...pronto, perfil })
      await carregar()
    } catch (erro) {
      setAviso(mensagemDe(erro, 'Não foi possível mudar a disponibilidade.'))
    } finally {
      setEmAndamento(null)
    }
  }

  async function responder(pedido: PedidoParaCarroceiro, acao: 'aceitar' | 'recusar') {
    setEmAndamento(`${acao}:${pedido.id}`)
    setAviso(null)
    try {
      if (acao === 'aceitar') await carroca.aceitar(pedido.id)
      else await carroca.recusar(pedido.id)
    } catch (erro) {
      // 409: outro carroceiro aceitou antes, ou o pedido venceu. A lista nova já tira ele.
      setAviso(mensagemDe(erro, 'Não foi possível responder ao pedido.'))
    } finally {
      setEmAndamento(null)
      await carregar()
    }
  }

  return (
    <section className="page carroceiro" aria-labelledby="titulo-carroceiro">
      <title>Painel do carroceiro · Algodoal Digital</title>
      <h1 id="titulo-carroceiro" className="so-leitor">
        Painel do carroceiro
      </h1>

      {!online && (
        <p className="aviso-erro" role="status">
          Sem internet: os pedidos novos aparecem quando o sinal voltar.
        </p>
      )}
      {aviso && (
        <p className="aviso-erro" role="alert">
          {aviso}
        </p>
      )}

      {estado.fase === 'carregando' ? (
        <Carregando rotulo="Carregando seu painel…" />
      ) : estado.fase === 'erro' ? (
        <EstadoVazio
          titulo="Painel do carroceiro"
          frase={estado.mensagem}
          acao={
            <Botao variante="secundario" onClick={() => void carregar()}>
              Tentar de novo
            </Botao>
          }
        />
      ) : (
        <>
          <Card className="carroceiro__perfil">
            <div>
              <p className="carroceiro__nome">{estado.perfil.display_name}</p>
              <p className="carroceiro__estado" id="estado-disponivel">
                {estado.perfil.is_available
                  ? `Disponível para viagens · até ${estado.perfil.capacity} pessoas`
                  : 'Indisponível: você não recebe pedidos'}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              className="carroceiro__chave"
              aria-checked={estado.perfil.is_available}
              aria-label="Disponível para viagens"
              aria-describedby="estado-disponivel"
              disabled={emAndamento === 'disponibilidade'}
              onClick={() => void alternarDisponivel()}
            >
              <span aria-hidden="true" />
            </button>
          </Card>

          {estado.perfil.is_available && (
            <section aria-labelledby="titulo-novos" className="carroceiro__bloco">
              <div className="carroceiro__bloco-topo">
                <Rotulo as="h2" id="titulo-novos">
                  {estado.abertos.length === 1
                    ? 'Nova solicitação'
                    : `Novas solicitações (${estado.abertos.length})`}
                </Rotulo>
                <button type="button" className="carroca__link" onClick={() => void carregar()}>
                  Atualizar
                </button>
              </div>
              {estado.abertos.length === 0 ? (
                <p className="carroca__dica">
                  Nenhum pedido agora. Esta tela atualiza sozinha a cada poucos segundos.
                </p>
              ) : (
                estado.abertos.map((pedido) => (
                  <Pedido
                    key={pedido.id}
                    pedido={pedido}
                    emAndamento={emAndamento}
                    aoAceitar={() => void responder(pedido, 'aceitar')}
                    aoRecusar={() => void responder(pedido, 'recusar')}
                  />
                ))
              )}
            </section>
          )}

          <Viagens viagens={estado.viagens} nome={estado.perfil.display_name} />
        </>
      )}
    </section>
  )
}

function Pedido({
  pedido,
  emAndamento,
  aoAceitar,
  aoRecusar,
}: {
  pedido: PedidoParaCarroceiro
  emAndamento: string | null
  aoAceitar: () => void
  aoRecusar: () => void
}) {
  const idTitulo = `pedido-${pedido.id}`
  return (
    <article className="carroceiro__pedido" aria-labelledby={idTitulo}>
      <h3 id={idTitulo} className="so-leitor">
        Pedido de {pedido.tourist_name}: {pedido.origin} para {pedido.destination}
      </h3>
      <dl className="carroceiro__dados">
        <div>
          <dt>Origem</dt>
          <dd className="carroceiro__lugar">{pedido.origin}</dd>
        </div>
        <div>
          <dt>Destino</dt>
          <dd className="carroceiro__lugar">{pedido.destination}</dd>
        </div>
        <div>
          <dt>Passageiros</dt>
          <dd className="carroceiro__lugar">{pedido.passengers}</dd>
        </div>
        {pedido.notes && (
          <div>
            <dt>Horário · observações</dt>
            <dd>{pedido.notes}</dd>
          </div>
        )}
      </dl>
      <p className="carroca__dica">
        Pedido de {pedido.tourist_name} · vence às {hora(pedido.expires_at)}
      </p>
      <Botao
        variante="grande"
        className="botao--largo"
        carregando={emAndamento === `aceitar:${pedido.id}`}
        disabled={emAndamento !== null}
        onClick={aoAceitar}
      >
        Aceitar
      </Botao>
      <Botao
        variante="secundario"
        className="botao--largo"
        carregando={emAndamento === `recusar:${pedido.id}`}
        disabled={emAndamento !== null}
        onClick={aoRecusar}
      >
        Recusar
      </Botao>
    </article>
  )
}

function Viagens({ viagens, nome }: { viagens: PedidoParaCarroceiro[]; nome: string }) {
  return (
    <section aria-labelledby="titulo-semana" className="carroceiro__bloco">
      <Rotulo as="h2" id="titulo-semana">
        Viagens da semana
      </Rotulo>
      {viagens.length === 0 ? (
        <p className="carroca__dica">As viagens que você aceitar aparecem aqui.</p>
      ) : (
        <ul className="carroceiro__viagens">
          {viagens.map((viagem) => (
            <li key={viagem.id}>
              <div>
                <strong>
                  {viagem.origin} <Icone nome="seta" tamanho="1em" />
                  <span className="so-leitor">para</span> {viagem.destination}
                </strong>
                <span>
                  {viagem.tourist_name} · {viagem.passengers}{' '}
                  {viagem.passengers === 1 ? 'pessoa' : 'pessoas'}
                  {viagem.status === 'cancelled' ? ' · cancelada pelo turista' : ''}
                </span>
              </div>
              <time dateTime={viagem.created_at}>{DIA_E_HORA.format(new Date(viagem.created_at))}</time>
              {viagem.tourist_whatsapp && (
                <a
                  className={classesBotao('primario')}
                  href={linkWhatsAppComTexto(
                    viagem.tourist_whatsapp,
                    `Olá, ${viagem.tourist_name}! Aqui é ${nome}, aceitei sua carroça no Algodoal Digital (${viagem.origin} → ${viagem.destination}).`,
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Chamar ${viagem.tourist_name} no WhatsApp`}
                >
                  <Icone nome="conversa" tamanho={18} />
                  WhatsApp
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
