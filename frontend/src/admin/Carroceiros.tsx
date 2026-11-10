import { useMemo, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router'
import { FalhaCarga } from '../components/FalhaCarga'
import { Botao } from '../components/ui/Botao'
import { Campo } from '../components/ui/Campo'
import { Carregando } from '../components/ui/Carregando'
import { EstadoVazio } from '../components/ui/EstadoVazio'
import { ErroApi } from '../lib/api'
import { linkWhatsAppComTexto, normalizar } from '../lib/formatos'
import type { CarroceiroAdmin, FiltrosCarroceiros, StatusCarroceiro } from '../lib/tipos'
import { useCarregar } from '../lib/useCarregar'
import { CAPACIDADE_MAXIMA, erroCapacidade, erroWhatsApp } from '../lib/validacao'
import { CaixaDeAviso, type Aviso } from './aviso'
import { Selecao } from './campos'
import { apiAdmin } from './cliente'

function useFiltros() {
  const [params, setParams] = useSearchParams()
  const definir = (chave: string, valor: string) =>
    setParams(
      (atuais) => {
        const novos = new URLSearchParams(atuais)
        if (valor) novos.set(chave, valor)
        else novos.delete(chave)
        return novos
      },
      { replace: true },
    )
  const filtros: FiltrosCarroceiros = {
    status: (params.get('status') as StatusCarroceiro) || undefined,
  }
  return { filtros, busca: params.get('q') ?? '', definir }
}

/** Carroceiros: o cadastro é aberto (sem aprovação), então aqui se corrige e se suspende. */
export function Carroceiros() {
  const { filtros, busca, definir } = useFiltros()
  const chave = `carroceiros:${JSON.stringify(filtros)}`
  const carga = useCarregar(chave, () => apiAdmin.carroceiros(filtros))
  const [alterados, setAlterados] = useState<Record<string, CarroceiroAdmin>>({})
  const [editando, setEditando] = useState<string | null>(null)
  const [aviso, setAviso] = useState<Aviso | null>(null)
  const [ocupado, setOcupado] = useState<string | null>(null)

  const linhas = useMemo(() => {
    if (carga.status !== 'ok') return []
    const termo = normalizar(busca)
    return carga.dados
      .map((c) => alterados[c.id] ?? c)
      .filter((c) => !termo || normalizar(`${c.display_name} ${c.email} ${c.whatsapp ?? ''}`).includes(termo))
  }, [carga, alterados, busca])

  function guardar(atualizado: CarroceiroAdmin) {
    setAlterados((atuais) => ({ ...atuais, [atualizado.id]: atualizado }))
  }

  async function alternarSuspensao(alvo: CarroceiroAdmin) {
    const suspender = alvo.is_approved
    const pergunta = suspender
      ? `Suspender "${alvo.display_name}"?\n\nO carroceiro para de receber e aceitar pedidos e sai da lista de contatos, até ser reativado.`
      : `Reativar "${alvo.display_name}"? Ele volta a poder receber pedidos.`
    if (!window.confirm(pergunta)) return
    setOcupado(alvo.id)
    setAviso(null)
    try {
      guardar(await apiAdmin.atualizarCarroceiro(alvo.id, { is_approved: !suspender }))
      setAviso({
        tipo: 'sucesso',
        texto: suspender ? `"${alvo.display_name}" foi suspenso.` : `"${alvo.display_name}" foi reativado.`,
      })
    } catch (erro) {
      setAviso({
        tipo: 'erro',
        texto: `Não foi possível mudar "${alvo.display_name}": ${erro instanceof ErroApi ? erro.mensagem : 'algo deu errado.'}`,
      })
    } finally {
      setOcupado(null)
    }
  }

  return (
    <section aria-labelledby="titulo-carroceiros">
      <title>Carroceiros · Painel · Algodoal Digital</title>
      <header className="admin__cabecalho">
        <div>
          <h1 id="titulo-carroceiros">Carroceiros</h1>
          <p className="admin__intro">
            Quem quiser se cadastra como carroceiro, sem aprovação. Aqui dá para corrigir os dados e
            suspender quem não deve receber pedidos.
          </p>
        </div>
      </header>

      <CaixaDeAviso aviso={aviso} />

      <div className="admin-filtros admin-filtros--dois" role="search" aria-label="Filtrar carroceiros">
        <Campo
          label="Buscar por nome, e-mail ou WhatsApp"
          type="search"
          value={busca}
          onChange={(e) => definir('q', e.target.value)}
          className="admin-filtros__busca"
        />
        <Selecao label="Situação" value={filtros.status ?? ''} onChange={(e) => definir('status', e.target.value)}>
          <option value="">Todas</option>
          <option value="aprovado">Aprovado</option>
          <option value="suspenso">Suspenso</option>
        </Selecao>
      </div>

      {carga.status === 'carregando' && <Carregando rotulo="Carregando carroceiros…" />}
      {carga.status === 'erro' && <FalhaCarga erro={carga.erro} aoTentar={carga.recarregar} />}
      {carga.status === 'ok' && linhas.length === 0 && (
        <EstadoVazio titulo="Nenhum carroceiro encontrado" frase="Mude a busca ou os filtros." />
      )}
      {linhas.length > 0 && (
        <div className="admin-tabela__rolagem">
          <table className="admin-tabela">
            <caption className="so-leitor">
              {linhas.length === 1 ? '1 carroceiro' : `${linhas.length} carroceiros`}
            </caption>
            <thead>
              <tr>
                <th scope="col">Carroceiro</th>
                <th scope="col">WhatsApp</th>
                <th scope="col">Capacidade</th>
                <th scope="col">Viagens na semana</th>
                <th scope="col">Situação</th>
                <th scope="col">
                  <span className="so-leitor">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((c) =>
                editando === c.id ? (
                  <Edicao
                    key={c.id}
                    carroceiro={c}
                    aoSalvar={(atualizado) => {
                      guardar(atualizado)
                      setEditando(null)
                      setAviso({ tipo: 'sucesso', texto: `"${atualizado.display_name}" foi salvo.` })
                    }}
                    aoCancelar={() => setEditando(null)}
                  />
                ) : (
                  <tr key={c.id} className={c.is_approved ? undefined : 'admin-tabela__removido'}>
                    <th scope="row">
                      <span className="admin-tabela__nome">{c.display_name}</span>
                      <span className="admin-tabela__sub">{c.email}</span>
                    </th>
                    <td className="admin-tabela__sem-quebra">
                      {c.whatsapp ? (
                        <a
                          href={linkWhatsAppComTexto(c.whatsapp, 'Olá! Aqui é da equipe do Algodoal Digital.')}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {c.whatsapp}
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      {c.capacity === 1 ? '1 pessoa' : `${c.capacity} pessoas`}
                      {/* Suspenso nunca recebe pedido, qualquer que seja a chave dele. */}
                      {c.is_approved && (
                        <span className="admin-tabela__sub">
                          {c.is_available ? 'disponível agora' : 'indisponível agora'}
                        </span>
                      )}
                    </td>
                    <td>{c.viagens_7_dias}</td>
                    <td>
                      <span className={`admin-status admin-status--${c.is_approved ? 'publicado' : 'removido'}`}>
                        {c.is_approved ? 'Aprovado' : 'Suspenso'}
                      </span>
                      {!c.conta_ativa && <span className="admin-tabela__sub">conta desativada</span>}
                    </td>
                    <td>
                      <div className="admin-tabela__acoes">
                        <Botao
                          variante="secundario"
                          className="botao--pequeno"
                          disabled={ocupado !== null}
                          aria-label={`Editar ${c.display_name}`}
                          onClick={() => setEditando(c.id)}
                        >
                          Editar
                        </Botao>
                        <Botao
                          variante="secundario"
                          className={c.is_approved ? 'botao--pequeno botao--perigo' : 'botao--pequeno'}
                          carregando={ocupado === c.id}
                          disabled={ocupado !== null && ocupado !== c.id}
                          aria-label={c.is_approved ? `Suspender ${c.display_name}` : `Reativar ${c.display_name}`}
                          onClick={() => alternarSuspensao(c)}
                        >
                          {c.is_approved ? 'Suspender' : 'Reativar'}
                        </Botao>
                      </div>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function Edicao({
  carroceiro,
  aoSalvar,
  aoCancelar,
}: {
  carroceiro: CarroceiroAdmin
  aoSalvar: (atualizado: CarroceiroAdmin) => void
  aoCancelar: () => void
}) {
  const [nome, setNome] = useState(carroceiro.display_name)
  const [whatsapp, setWhatsapp] = useState(carroceiro.whatsapp ?? '')
  const [capacidade, setCapacidade] = useState(String(carroceiro.capacity))
  const [erros, setErros] = useState<Record<string, string>>({})
  const [enviando, setEnviando] = useState(false)

  async function salvar(evento: FormEvent) {
    evento.preventDefault()
    const novos: Record<string, string> = {}
    if (!nome.trim()) novos.display_name = 'Informe o nome.'
    const erroZap = erroWhatsApp(whatsapp)
    if (erroZap) novos.whatsapp = erroZap
    const erroCap = erroCapacidade(capacidade)
    if (erroCap) novos.capacity = erroCap
    setErros(novos)
    if (Object.keys(novos).length) return
    setEnviando(true)
    try {
      aoSalvar(
        await apiAdmin.atualizarCarroceiro(carroceiro.id, {
          display_name: nome.trim(),
          whatsapp: whatsapp.trim(),
          capacity: Number(capacidade),
        }),
      )
    } catch (erro) {
      if (erro instanceof ErroApi && Object.keys(erro.campos).length) setErros(erro.campos)
      else setErros({ geral: erro instanceof ErroApi ? erro.mensagem : 'Não foi possível salvar.' })
    } finally {
      setEnviando(false)
    }
  }

  return (
    <tr className="admin-tabela__edicao">
      <td colSpan={6}>
        <form className="admin-edicao" onSubmit={salvar} noValidate aria-label={`Editar ${carroceiro.display_name}`}>
          {erros.geral && (
            <p className="aviso-erro" role="alert">
              {erros.geral}
            </p>
          )}
          <Campo label="Nome na carroça" value={nome} maxLength={120} erro={erros.display_name} onChange={(e) => setNome(e.target.value)} />
          <Campo label="WhatsApp" type="tel" inputMode="tel" value={whatsapp} erro={erros.whatsapp} onChange={(e) => setWhatsapp(e.target.value)} />
          <Campo
            label="Capacidade (pessoas)"
            type="number"
            min={1}
            max={CAPACIDADE_MAXIMA}
            value={capacidade}
            erro={erros.capacity}
            onChange={(e) => setCapacidade(e.target.value)}
          />
          <div className="admin-edicao__acoes">
            <Botao type="submit" carregando={enviando}>
              Salvar
            </Botao>
            <Botao variante="secundario" onClick={aoCancelar}>
              Cancelar
            </Botao>
          </div>
        </form>
      </td>
    </tr>
  )
}
