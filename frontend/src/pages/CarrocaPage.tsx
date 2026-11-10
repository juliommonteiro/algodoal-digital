import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { useAuth } from '../auth/contexto'
import { Icone } from '../components/Icone'
import { Botao } from '../components/ui/Botao'
import { Campo } from '../components/ui/Campo'
import { Card } from '../components/ui/Card'
import { Carregando } from '../components/ui/Carregando'
import { classesBotao } from '../components/ui/classes'
import { Rotulo } from '../components/ui/Rotulo'
import { ErroApi } from '../lib/api'
import {
  carroca,
  contatosGuardados,
  guardarContatos,
  guardarWhatsapp,
  INTERVALO_DE_ATUALIZACAO_MS,
  whatsappGuardado,
  type ContatosGuardados,
} from '../lib/carroca'
import { linkWhatsAppComTexto } from '../lib/formatos'
import type { PedidoDoTurista } from '../lib/tipos'
import { useOnlineStatus } from '../lib/useOnlineStatus'
import { useRepetir } from '../lib/useRepetir'
import { CAPACIDADE_MAXIMA, erroWhatsApp, primeiroComErro, type ErrosDe } from '../lib/validacao'

type CampoPedido = 'origin' | 'destination' | 'passengers' | 'notes' | 'whatsapp'
const ORDEM: readonly CampoPedido[] = ['origin', 'destination', 'passengers', 'notes', 'whatsapp']

type Estado =
  | { fase: 'carregando' }
  | { fase: 'erro'; mensagem: string }
  | { fase: 'pronto'; pedido: PedidoDoTurista | null }

const CHAVE_DISPENSADO = 'algodoal:pedido-dispensado'

function lerDispensado(): string | null {
  try {
    return localStorage.getItem(CHAVE_DISPENSADO)
  } catch {
    return null
  }
}

const DIA_E_HORA = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

function hora(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(
    new Date(iso),
  )
}

export function CarrocaPage() {
  const online = useOnlineStatus()
  const [estado, setEstado] = useState<Estado>({ fase: 'carregando' })
  const [dispensado, setDispensado] = useState<string | null>(lerDispensado)
  const [contatos, setContatos] = useState<ContatosGuardados | null>(contatosGuardados)
  const [ocupado, setOcupado] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)

  const carregar = useCallback(
    () =>
      carroca.pedidoAtual().then(
        (pedido) => setEstado({ fase: 'pronto', pedido }),
        (erro: unknown) =>
          setEstado((atual) =>
            // Uma falha na atualização automática não apaga o que já está na tela.
            atual.fase === 'pronto'
              ? atual
              : {
                  fase: 'erro',
                  mensagem: erro instanceof ErroApi ? erro.mensagem : 'Não foi possível carregar.',
                },
          ),
      ),
    [],
  )

  useEffect(() => {
    if (!online) return
    carregar()
    carroca
      .contatos()
      .then((lista) => {
        guardarContatos(lista)
        setContatos(contatosGuardados() ?? { contatos: lista, salvoEm: new Date().toISOString() })
      })
      .catch(() => {
        // Sem a lista nova, fica a guardada.
      })
  }, [online, carregar])

  const pedido = estado.fase === 'pronto' ? estado.pedido : null
  const visivel = pedido && pedido.id !== dispensado ? pedido : null
  useRepetir(() => void carregar(), INTERVALO_DE_ATUALIZACAO_MS, visivel?.status === 'pending')

  function dispensar() {
    if (!pedido) return
    try {
      localStorage.setItem(CHAVE_DISPENSADO, pedido.id)
    } catch {
      // sem armazenamento local: dispensa só nesta visita
    }
    setDispensado(pedido.id)
    setAviso(null)
  }

  async function cancelar() {
    if (!visivel) return
    setOcupado(true)
    setAviso(null)
    try {
      await carroca.cancelar(visivel.id)
      await carregar()
    } catch (erro) {
      setAviso(erro instanceof ErroApi ? erro.mensagem : 'Não foi possível cancelar agora.')
      await carregar()
    } finally {
      setOcupado(false)
    }
  }

  return (
    <section className="page carroca" aria-labelledby="titulo-carroca">
      <title>Carroça · Algodoal Digital</title>
      <header className="carroca__cabecalho">
        <h1 id="titulo-carroca">Solicitar carroça</h1>
        <p className="page__intro">
          Conexão direta com os carroceiros da ilha. Sem pagamento no app.
        </p>
      </header>

      {aviso && (
        <p className="aviso-erro" role="alert">
          {aviso}
        </p>
      )}

      {!online ? (
        <SemInternet contatos={contatos} />
      ) : estado.fase === 'carregando' ? (
        <Carregando rotulo="Carregando seu pedido…" />
      ) : estado.fase === 'erro' ? (
        <Card className="carroca__cartao">
          <p>{estado.mensagem}</p>
          <Botao variante="secundario" onClick={() => void carregar()}>
            Tentar de novo
          </Botao>
        </Card>
      ) : !visivel ? (
        <FormularioDePedido
          aoPedir={(novo) => {
            setEstado({ fase: 'pronto', pedido: novo })
            setAviso(null)
          }}
          aoJaTerPedido={() => void carregar()}
        />
      ) : visivel.status === 'pending' ? (
        <Procurando
          pedido={visivel}
          ocupado={ocupado}
          aoCancelar={cancelar}
          aoAtualizar={() => void carregar()}
        />
      ) : visivel.status === 'accepted' ? (
        <Aceito pedido={visivel} ocupado={ocupado} aoCancelar={cancelar} aoNovo={dispensar} />
      ) : (
        <Vencido contatos={contatos} aoPedirDeNovo={dispensar} />
      )}
    </section>
  )
}

// ----------------------------------------------------------------------------- formulário

function FormularioDePedido({
  aoPedir,
  aoJaTerPedido,
}: {
  aoPedir: (pedido: PedidoDoTurista) => void
  aoJaTerPedido: () => void
}) {
  const { usuario } = useAuth()
  const [origem, setOrigem] = useState('')
  const [destino, setDestino] = useState('')
  const [passageiros, setPassageiros] = useState(1)
  const [observacoes, setObservacoes] = useState('')
  const [whatsapp, setWhatsapp] = useState(whatsappGuardado)
  const [erros, setErros] = useState<ErrosDe<CampoPedido>>({})
  const [erroGeral, setErroGeral] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const refOrigem = useRef<HTMLInputElement>(null)
  const refDestino = useRef<HTMLInputElement>(null)
  const refPassageiros = useRef<HTMLButtonElement>(null)
  const refObservacoes = useRef<HTMLInputElement>(null)
  const refWhatsapp = useRef<HTMLInputElement>(null)

  function focar(campo: CampoPedido) {
    const refs = {
      origin: refOrigem,
      destination: refDestino,
      passengers: refPassageiros,
      notes: refObservacoes,
      whatsapp: refWhatsapp,
    }
    refs[campo].current?.focus()
  }

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    setErroGeral(null)
    const novos: ErrosDe<CampoPedido> = {}
    if (!origem.trim()) novos.origin = 'Informe onde você está.'
    if (!destino.trim()) novos.destination = 'Informe para onde vai.'
    const erroZap = erroWhatsApp(whatsapp)
    if (erroZap) novos.whatsapp = erroZap
    setErros(novos)
    const primeiro = primeiroComErro(ORDEM, novos)
    if (primeiro) return focar(primeiro)

    setEnviando(true)
    try {
      const pedido = await carroca.pedir({
        origin: origem.trim(),
        destination: destino.trim(),
        passengers: passageiros,
        notes: observacoes.trim() || null,
        whatsapp: whatsapp.trim(),
      })
      guardarWhatsapp(whatsapp.trim())
      aoPedir(pedido)
    } catch (erro) {
      if (erro instanceof ErroApi && erro.status === 409) return aoJaTerPedido()
      if (erro instanceof ErroApi && erro.status === 422) {
        const daApi: ErrosDe<CampoPedido> = {}
        for (const campo of ORDEM) if (erro.campos[campo]) daApi[campo] = erro.campos[campo]
        const primeiroDaApi = primeiroComErro(ORDEM, daApi)
        if (primeiroDaApi) {
          setErros(daApi)
          return focar(primeiroDaApi)
        }
      }
      setErroGeral(erro instanceof ErroApi ? erro.mensagem : 'Não foi possível enviar o pedido.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form className="formulario carroca__formulario" noValidate onSubmit={enviar}>
      {erroGeral && (
        <p className="aviso-erro" role="alert">
          {erroGeral}
        </p>
      )}
      <Card className="carroca__cartao">
        <Campo
          ref={refOrigem}
          label="Origem"
          name="origem"
          placeholder="Vila de Algodoal — orla"
          value={origem}
          onChange={(ev) => setOrigem(ev.target.value)}
          erro={erros.origin}
        />
        <Campo
          ref={refDestino}
          label="Destino"
          name="destino"
          placeholder="Praia da Princesa"
          value={destino}
          onChange={(ev) => setDestino(ev.target.value)}
          erro={erros.destination}
        />
      </Card>

      <Card className="carroca__cartao carroca__passageiros">
        <div>
          <Rotulo as="span" id="rotulo-passageiros">
            Passageiros
          </Rotulo>
          <p className="carroca__contagem" aria-live="polite" aria-labelledby="rotulo-passageiros">
            {passageiros === 1 ? '1 pessoa' : `${passageiros} pessoas`}
          </p>
          {erros.passengers && <p className="campo__erro">{erros.passengers}</p>}
        </div>
        <div className="carroca__stepper">
          <button
            ref={refPassageiros}
            type="button"
            className="carroca__passo"
            aria-label="Menos um passageiro"
            disabled={passageiros <= 1}
            onClick={() => setPassageiros((n) => Math.max(1, n - 1))}
          >
            −
          </button>
          <button
            type="button"
            className="carroca__passo"
            aria-label="Mais um passageiro"
            disabled={passageiros >= CAPACIDADE_MAXIMA}
            onClick={() => setPassageiros((n) => Math.min(CAPACIDADE_MAXIMA, n + 1))}
          >
            +
          </button>
        </div>
      </Card>

      <Card className="carroca__cartao">
        <Campo
          ref={refObservacoes}
          label="Horário · observações"
          name="observacoes"
          placeholder="Agora · duas malas grandes"
          maxLength={300}
          value={observacoes}
          onChange={(ev) => setObservacoes(ev.target.value)}
          erro={erros.notes}
        />
        <Campo
          ref={refWhatsapp}
          label="Seu WhatsApp com DDD"
          type="tel"
          name="whatsapp"
          autoComplete="tel"
          inputMode="tel"
          placeholder="(91) 98888-7777"
          value={whatsapp}
          onChange={(ev) => setWhatsapp(ev.target.value)}
          erro={erros.whatsapp}
        />
        <p className="carroca__dica">Só o carroceiro que aceitar o pedido vê o seu número.</p>
      </Card>

      <Botao type="submit" variante="grande" className="botao--largo" carregando={enviando}>
        Solicitar carroça
      </Botao>
      <p className="carroca__dica">
        {usuario ? `Pedindo como ${usuario.name.split(' ')[0]}. ` : ''}Sem pagamento no app e sem
        GPS em tempo real.
      </p>
    </form>
  )
}

// ---------------------------------------------------------------------------- situações

function Resumo({ pedido }: { pedido: PedidoDoTurista }) {
  return (
    <p className="carroca__resumo">
      {pedido.origin} <Icone nome="seta" tamanho="1em" />
      <span className="so-leitor">para</span> {pedido.destination} ·{' '}
      {pedido.passengers === 1 ? '1 pessoa' : `${pedido.passengers} pessoas`}
    </p>
  )
}

function Procurando({
  pedido,
  ocupado,
  aoCancelar,
  aoAtualizar,
}: {
  pedido: PedidoDoTurista
  ocupado: boolean
  aoCancelar: () => void
  aoAtualizar: () => void
}) {
  return (
    <div className="carroca__situacao" role="status">
      <span className="carroca__pulso" aria-hidden="true" />
      <h2>Procurando carroceiros</h2>
      <p>
        Sua solicitação foi enviada aos carroceiros disponíveis. Se ninguém aceitar até{' '}
        <strong>{hora(pedido.expires_at)}</strong>, ela vence e você pode chamar direto pelo
        WhatsApp.
      </p>
      <Resumo pedido={pedido} />
      <div className="carroca__acoes">
        <Botao variante="secundario" carregando={ocupado} onClick={aoCancelar}>
          Cancelar solicitação
        </Botao>
        <button type="button" className="carroca__link" onClick={aoAtualizar}>
          Atualizar
        </button>
      </div>
    </div>
  )
}

function Aceito({
  pedido,
  ocupado,
  aoCancelar,
  aoNovo,
}: {
  pedido: PedidoDoTurista
  ocupado: boolean
  aoCancelar: () => void
  aoNovo: () => void
}) {
  const carroceiro = pedido.carrier
  return (
    <div className="carroca__situacao carroca__situacao--aceito" role="status">
      <span className="carroca__selo" aria-hidden="true">
        <Icone nome="conferido" tamanho={28} />
      </span>
      <h2>{carroceiro ? `${carroceiro.display_name} aceitou` : 'Pedido aceito'}</h2>
      <p>Combine o ponto de encontro pelo WhatsApp.</p>
      <Resumo pedido={pedido} />
      {carroceiro?.whatsapp && (
        <a
          className={classesBotao('primario', 'botao--largo')}
          href={linkWhatsAppComTexto(
            carroceiro.whatsapp,
            `Olá! Fiz o pedido de carroça no Algodoal Digital: ${pedido.origin} → ${pedido.destination}.`,
          )}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Icone nome="conversa" tamanho={20} />
          Chamar {carroceiro.display_name} no WhatsApp
        </a>
      )}
      <div className="carroca__acoes">
        <Botao variante="secundario" onClick={aoNovo}>
          Fazer outro pedido
        </Botao>
        <button type="button" className="carroca__link" disabled={ocupado} onClick={aoCancelar}>
          Cancelar viagem
        </button>
      </div>
    </div>
  )
}

function Vencido({
  contatos,
  aoPedirDeNovo,
}: {
  contatos: ContatosGuardados | null
  aoPedirDeNovo: () => void
}) {
  return (
    <div className="carroca__situacao" role="status">
      <h2>Ninguém aceitou a tempo</h2>
      <p>Você pode pedir de novo ou chamar um carroceiro direto pelo WhatsApp.</p>
      <Botao className="botao--largo" onClick={aoPedirDeNovo}>
        Pedir de novo
      </Botao>
      <ListaDeContatos contatos={contatos} />
    </div>
  )
}

function SemInternet({ contatos }: { contatos: ContatosGuardados | null }) {
  return (
    <Card className="carroca__cartao carroca__sem-rede">
      <h2 className="carroca__subtitulo">Pedir carroça precisa de internet</h2>
      <p>
        Um pedido enviado horas depois não serve para ninguém, então ele não fica guardado para
        mandar depois. Sem sinal, chame um carroceiro direto pelo WhatsApp: a mensagem sai quando o
        celular pegar rede.
      </p>
      <ListaDeContatos contatos={contatos} />
    </Card>
  )
}

function ListaDeContatos({ contatos }: { contatos: ContatosGuardados | null }) {
  if (!contatos || contatos.contatos.length === 0) {
    return (
      <p className="carroca__dica">
        Ainda não há contatos guardados neste aparelho. Abra esta tela uma vez com internet.
      </p>
    )
  }
  return (
    <section className="carroca__contatos" aria-labelledby="titulo-contatos">
      <Rotulo as="h3" id="titulo-contatos">
        Carroceiros
      </Rotulo>
      <ul>
        {contatos.contatos.map((contato) => (
          <li key={`${contato.display_name}-${contato.whatsapp}`}>
            <div>
              <strong>{contato.display_name}</strong>
              <span>
                até {contato.capacity} {contato.capacity === 1 ? 'pessoa' : 'pessoas'}
                {contato.is_available ? '' : ' · indisponível agora'}
              </span>
            </div>
            {contato.whatsapp && (
              <a
                className={classesBotao('secundario')}
                href={linkWhatsAppComTexto(
                  contato.whatsapp,
                  'Olá! Vi seu contato no Algodoal Digital e preciso de uma carroça.',
                )}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Chamar ${contato.display_name} no WhatsApp`}
              >
                <Icone nome="conversa" tamanho={18} />
                WhatsApp
              </a>
            )}
          </li>
        ))}
      </ul>
      <p className="carroca__dica">
        Lista guardada em {DIA_E_HORA.format(new Date(contatos.salvoEm))}.
      </p>
    </section>
  )
}
