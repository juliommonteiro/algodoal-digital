import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { FalhaCarga } from '../components/FalhaCarga'
import { Botao } from '../components/ui/Botao'
import { Campo } from '../components/ui/Campo'
import { Carregando } from '../components/ui/Carregando'
import { classesBotao } from '../components/ui/classes'
import { EstadoVazio } from '../components/ui/EstadoVazio'
import { ErroApi } from '../lib/api'
import { erroDeLatitude, erroDeLongitude } from '../lib/areaDoMapa'
import { DIAS, ROTULO_TIPO } from '../lib/formatos'
import type { Categoria, LocalAdmin, LocalEntrada, NegocioEntrada, TipoLocal } from '../lib/tipos'
import { useCarregar } from '../lib/useCarregar'
import { CaixaDeAviso, type Aviso } from './aviso'
import { AreaDeTexto, Caixa, Selecao } from './campos'
import { apiAdmin, statusDoLocal } from './cliente'
import { opcoesDeCategoria, ROTULO_STATUS } from './opcoes'

// ---------------------------------------------------------------------------
// Estado do formulário: tudo texto, como o usuário digita; vira LocalEntrada só ao enviar.
// ---------------------------------------------------------------------------

type Faixa = '' | '$' | '$$' | '$$$'

interface Formulario {
  name: string
  description: string
  kind: TipoLocal | ''
  category_id: string
  latitude: string
  longitude: string
  is_published: boolean
  temNegocio: boolean
  whatsapp: string
  phone: string
  price_range: Faixa
  /** Separados por vírgula. */
  services: string
  is_partner: boolean
  /** Por dia: "07:00-12:00, 14:00-21:00"; vazio = fechado. */
  horarios: Record<string, string>
}

/** Ordem do formulário: o foco vai para o primeiro campo com erro. */
const ORDEM = [
  'name',
  'kind',
  'category_id',
  'latitude',
  'longitude',
  'description',
  'whatsapp',
  'phone',
  'price_range',
  'services',
  ...DIAS.map(([dia]) => `horarios.${dia}`),
] as const

type Erros = Record<string, string>

const VAZIO: Formulario = {
  name: '',
  description: '',
  kind: '',
  category_id: '',
  latitude: '',
  longitude: '',
  is_published: true,
  temNegocio: false,
  whatsapp: '',
  phone: '',
  price_range: '',
  services: '',
  is_partner: false,
  horarios: {},
}

const virgula = (n: number) => String(n).replace('.', ',')

function doLocal(local: LocalAdmin): Formulario {
  const negocio = local.business
  return {
    name: local.name,
    description: local.description ?? '',
    kind: local.kind,
    category_id: local.category_id,
    latitude: virgula(local.latitude),
    longitude: virgula(local.longitude),
    is_published: local.is_published,
    temNegocio: negocio !== null,
    whatsapp: negocio?.whatsapp ?? '',
    phone: negocio?.phone ?? '',
    price_range: (negocio?.price_range as Faixa | null) ?? '',
    services: negocio?.services.join(', ') ?? '',
    is_partner: negocio?.is_partner ?? false,
    horarios: Object.fromEntries(
      Object.entries(negocio?.opening_hours ?? {}).map(([dia, faixas]) => [
        dia,
        faixas.map(([abre, fecha]) => `${abre}-${fecha}`).join(', '),
      ]),
    ),
  }
}

/** "-0,5795" ou "-0.5795" → -0.5795; texto que não é número → NaN. */
function numero(texto: string): number {
  const limpo = texto.trim().replace(',', '.')
  return limpo ? Number(limpo) : Number.NaN
}

const FAIXA_HORARIO = /^([01]\d|2[0-3]):([0-5]\d)\s*[-–]\s*([01]\d|2[0-3]):([0-5]\d)$/

function faixasDoDia(texto: string): [string, string][] | null {
  const partes = texto
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
  const faixas: [string, string][] = []
  for (const parte of partes) {
    const casa = parte.match(FAIXA_HORARIO)
    if (!casa) return null
    faixas.push([`${casa[1]}:${casa[2]}`, `${casa[3]}:${casa[4]}`])
  }
  return faixas
}

function validar(f: Formulario): Erros {
  const erros: Erros = {}
  if (!f.name.trim()) erros.name = 'Informe o nome do local.'
  if (!f.kind) erros.kind = 'Escolha o tipo.'
  if (!f.category_id) erros.category_id = 'Escolha a categoria.'

  for (const [campo, rotulo, dentroDaArea] of [
    ['latitude', 'a latitude', erroDeLatitude],
    ['longitude', 'a longitude', erroDeLongitude],
  ] as const) {
    const valor = numero(f[campo])
    if (!f[campo].trim()) erros[campo] = `Informe ${rotulo}.`
    else if (Number.isNaN(valor)) erros[campo] = 'Use um número, ex.: -0,5795.'
    else {
      const erro = dentroDaArea(valor)
      if (erro) erros[campo] = erro
    }
  }

  if (f.temNegocio) {
    for (const [dia, nome] of DIAS) {
      const texto = f.horarios[dia] ?? ''
      const faixas = faixasDoDia(texto)
      if (!faixas) {
        erros[`horarios.${dia}`] = `${nome}: use HH:MM-HH:MM, ex.: 07:00-12:00, 14:00-21:00.`
      } else if (faixas.some(([abre, fecha]) => abre >= fecha)) {
        erros[`horarios.${dia}`] = `${nome}: o horário de abrir precisa vir antes do de fechar.`
      }
    }
  }
  return erros
}

function paraEntrada(f: Formulario): LocalEntrada {
  let business: NegocioEntrada | null = null
  if (f.temNegocio) {
    const opening_hours: Record<string, [string, string][]> = {}
    for (const [dia] of DIAS) {
      const faixas = faixasDoDia(f.horarios[dia] ?? '') ?? []
      if (faixas.length) opening_hours[dia] = faixas
    }
    business = {
      whatsapp: f.whatsapp.trim() || null,
      phone: f.phone.trim() || null,
      opening_hours: Object.keys(opening_hours).length ? opening_hours : null,
      price_range: f.price_range || null,
      services: f.services
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      is_partner: f.is_partner,
    }
  }
  return {
    name: f.name.trim(),
    description: f.description.trim() || null,
    kind: f.kind as TipoLocal,
    category_id: f.category_id,
    latitude: numero(f.latitude),
    longitude: numero(f.longitude),
    is_published: f.is_published,
    business,
  }
}

/** PATCH leva só o que mudou: editar o nome não reescreve os dados comerciais. */
function mudancas(antes: LocalEntrada, depois: LocalEntrada): Partial<LocalEntrada> {
  const resultado: Partial<LocalEntrada> = {}
  for (const chave of Object.keys(depois) as (keyof LocalEntrada)[]) {
    if (JSON.stringify(antes[chave]) !== JSON.stringify(depois[chave])) {
      Object.assign(resultado, { [chave]: depois[chave] })
    }
  }
  return resultado
}

/**
 * Erros da API (loc → msg) para os campos do formulário. Os de dados comerciais chegam como
 * "business.whatsapp", "business.services.0", "business.opening_hours"…
 */
function errosDaApi(campos: Record<string, string>): {
  erros: Erros
  soltos: string[]
} {
  const erros: Erros = {}
  const soltos: string[] = []
  for (const [caminho, msg] of Object.entries(campos)) {
    const [raiz, campo] = caminho.split('.')
    let alvo: string | null = null
    if (raiz !== 'business') alvo = ORDEM.includes(raiz as never) ? raiz : null
    else if (campo === 'opening_hours') alvo = 'horarios'
    else if (campo && ORDEM.includes(campo as never)) alvo = campo
    if (alvo && !erros[alvo]) erros[alvo] = msg
    else if (!alvo) soltos.push(msg)
  }
  return { erros, soltos }
}

function semCampos(erros: Erros, ...campos: string[]): Erros {
  return Object.fromEntries(Object.entries(erros).filter(([campo]) => !campos.includes(campo)))
}

const idDoCampo = (campo: string) => `local-${campo.replace('.', '-')}`

function focarPrimeiroErro(erros: Erros) {
  const primeiro = [...ORDEM, 'horarios'].find((campo) => erros[campo])
  const alvo = primeiro === 'horarios' ? 'horarios.seg' : primeiro
  if (alvo) document.getElementById(idDoCampo(alvo))?.focus()
}

// ---------------------------------------------------------------------------

/** `id` null: cadastro de um local novo. */
export function FormularioDoLocal({ id }: { id: string | null }) {
  const categorias = useCarregar('categorias', () => apiAdmin.categorias())
  const local = useCarregar(id ?? 'novo', () => (id ? apiAdmin.local(id) : Promise.resolve(null)))

  if (categorias.status === 'carregando' || local.status === 'carregando') {
    return <Carregando rotulo="Carregando o local…" />
  }
  if (local.status === 'erro') {
    if (local.erro.status === 404) {
      return (
        <EstadoVazio
          nivel="h1"
          titulo="Local não encontrado"
          frase="Ele pode ter sido apagado do banco, ou o endereço está errado."
          acao={
            <Link to="/admin/locais" className={classesBotao('secundario')}>
              Voltar à lista
            </Link>
          }
        />
      )
    }
    return <FalhaCarga erro={local.erro} aoTentar={local.recarregar} />
  }
  if (categorias.status === 'erro') {
    return <FalhaCarga erro={categorias.erro} aoTentar={categorias.recarregar} />
  }
  // key: trocar de um local para outro recomeça o formulário do zero.
  return <Edicao key={id ?? 'novo'} original={local.dados} categorias={categorias.dados} />
}

function Edicao({
  original,
  categorias,
}: {
  original: LocalAdmin | null
  categorias: Categoria[]
}) {
  const navegar = useNavigate()
  const [atual, setAtual] = useState(original)
  const [f, setF] = useState<Formulario>(() => (original ? doLocal(original) : VAZIO))
  const [erros, setErros] = useState<Erros>({})
  const [aviso, setAviso] = useState<Aviso | null>(null)
  const [enviando, setEnviando] = useState(false)

  const removido = atual ? statusDoLocal(atual) === 'removido' : false

  function mudar<C extends keyof Formulario>(campo: C, valor: Formulario[C]) {
    setF((antes) => ({ ...antes, [campo]: valor }))
    // Corrigiu o campo: o erro dele sai (o resto fica até o próximo envio).
    if (erros[campo]) setErros((atuais) => semCampos(atuais, campo))
  }

  function mudarHorario(dia: string, valor: string) {
    setF((antes) => ({
      ...antes,
      horarios: { ...antes.horarios, [dia]: valor },
    }))
    const chave = `horarios.${dia}`
    if (erros[chave] || erros.horarios) {
      setErros((atuais) => semCampos(atuais, chave, 'horarios'))
    }
  }

  async function enviar(evento: FormEvent) {
    evento.preventDefault()
    setAviso(null)
    const locais = validar(f)
    setErros(locais)
    if (Object.keys(locais).length) {
      setAviso({ tipo: 'erro', texto: 'Confira os campos marcados.' })
      focarPrimeiroErro(locais)
      return
    }

    const entrada = paraEntrada(f)
    setEnviando(true)
    try {
      let salvo: LocalAdmin
      if (atual) {
        const corpo = mudancas(paraEntrada(doLocal(atual)), entrada)
        if (!Object.keys(corpo).length) {
          setAviso({
            tipo: 'sucesso',
            texto: 'Nada mudou: não havia o que salvar.',
          })
          return
        }
        salvo = await apiAdmin.atualizar(atual.id, corpo)
      } else {
        salvo = await apiAdmin.criar(entrada)
      }
      navegar('/admin/locais', {
        state: {
          aviso: {
            tipo: 'sucesso',
            texto: atual ? `"${salvo.name}" foi salvo.` : `"${salvo.name}" foi criado.`,
          } satisfies Aviso,
        },
      })
    } catch (erro) {
      if (erro instanceof ErroApi && Object.keys(erro.campos).length) {
        const { erros: daApi, soltos } = errosDaApi(erro.campos)
        setErros(daApi)
        setAviso({
          tipo: 'erro',
          texto: ['A API recusou: confira os campos marcados.', ...soltos].join(' '),
        })
        focarPrimeiroErro(daApi)
      } else {
        const mensagem = erro instanceof ErroApi ? erro.mensagem : 'Algo deu errado.'
        setAviso({
          tipo: 'erro',
          texto: `Não foi possível salvar: ${mensagem}`,
        })
      }
    } finally {
      setEnviando(false)
    }
  }

  async function restaurar() {
    if (!atual) return
    setEnviando(true)
    setAviso(null)
    try {
      setAtual(await apiAdmin.restaurar(atual.id))
      setAviso({ tipo: 'sucesso', texto: `"${atual.name}" foi restaurado.` })
    } catch (erro) {
      const mensagem = erro instanceof ErroApi ? erro.mensagem : 'Algo deu errado.'
      setAviso({
        tipo: 'erro',
        texto: `Não foi possível restaurar: ${mensagem}`,
      })
    } finally {
      setEnviando(false)
    }
  }

  const titulo = atual ? `Editar ${atual.name}` : 'Novo local'

  return (
    <section aria-labelledby="titulo-form">
      <title>{`${titulo} · Painel · Algodoal Digital`}</title>
      <header className="admin__cabecalho">
        <div>
          <Link to="/admin/locais" className="admin__migalha">
            ← Locais
          </Link>
          <h1 id="titulo-form">{atual ? atual.name : 'Novo local'}</h1>
          {atual && (
            <p className="admin__intro">
              <span className={`admin-status admin-status--${statusDoLocal(atual)}`}>
                {ROTULO_STATUS[statusDoLocal(atual)]}
              </span>
            </p>
          )}
        </div>
      </header>

      <CaixaDeAviso aviso={aviso} />

      {removido && (
        <div className="admin-removido">
          <p>Este local está removido: não aparece no mapa público. Restaure para ele voltar.</p>
          <Botao variante="secundario" carregando={enviando} onClick={restaurar}>
            Restaurar
          </Botao>
        </div>
      )}

      <form className="admin-form" onSubmit={enviar} noValidate>
        <fieldset className="admin-form__secao">
          <legend>Local</legend>
          <Campo
            id={idDoCampo('name')}
            label="Nome"
            value={f.name}
            maxLength={160}
            required
            erro={erros.name}
            onChange={(e) => mudar('name', e.target.value)}
            className="admin-form__largo"
          />
          <Selecao
            id={idDoCampo('kind')}
            label="Tipo"
            value={f.kind}
            required
            erro={erros.kind}
            onChange={(e) => mudar('kind', e.target.value as TipoLocal | '')}
          >
            <option value="">Escolha…</option>
            {(Object.entries(ROTULO_TIPO) as [TipoLocal, string][]).map(([valor, rotulo]) => (
              <option key={valor} value={valor}>
                {rotulo}
              </option>
            ))}
          </Selecao>
          <Selecao
            id={idDoCampo('category_id')}
            label="Categoria"
            value={f.category_id}
            required
            erro={erros.category_id}
            onChange={(e) => mudar('category_id', e.target.value)}
          >
            <option value="">Escolha…</option>
            {opcoesDeCategoria(categorias).map(({ categoria, rotulo }) => (
              <option key={categoria.id} value={categoria.id}>
                {rotulo}
              </option>
            ))}
          </Selecao>
          <Campo
            id={idDoCampo('latitude')}
            label="Latitude"
            inputMode="decimal"
            placeholder="-0,5795"
            value={f.latitude}
            required
            erro={erros.latitude}
            onChange={(e) => mudar('latitude', e.target.value)}
          />
          <Campo
            id={idDoCampo('longitude')}
            label="Longitude"
            inputMode="decimal"
            placeholder="-47,5796"
            value={f.longitude}
            required
            erro={erros.longitude}
            onChange={(e) => mudar('longitude', e.target.value)}
          />
          <p className="campo__dica admin-form__largo">
            A área do mapa vai de -0,66 a -0,56 de latitude e de -47,68 a -47,51 de longitude (da
            ilha até Marudá). Fora dela, o local não aparece no mapa.
          </p>
          <AreaDeTexto
            id={idDoCampo('description')}
            label="Descrição"
            rows={4}
            value={f.description}
            erro={erros.description}
            onChange={(e) => mudar('description', e.target.value)}
            className="admin-form__largo"
          />
          <Caixa
            label="Publicado no mapa"
            dica="Desmarcado, fica como rascunho: só o painel vê."
            checked={f.is_published}
            onChange={(e) => mudar('is_published', e.target.checked)}
            className="admin-form__largo"
          />
        </fieldset>

        <fieldset className="admin-form__secao">
          <legend>Dados comerciais</legend>
          <Caixa
            label="Este local é um estabelecimento (tem contato, horário ou preço)"
            dica={
              atual?.business && !f.temNegocio
                ? 'Ao salvar, os dados comerciais deste local serão apagados.'
                : undefined
            }
            checked={f.temNegocio}
            onChange={(e) => mudar('temNegocio', e.target.checked)}
            className="admin-form__largo"
          />
          {f.temNegocio && (
            <>
              <Campo
                id={idDoCampo('whatsapp')}
                label="WhatsApp"
                inputMode="tel"
                placeholder="(91) 95555-0000"
                maxLength={30}
                value={f.whatsapp}
                erro={erros.whatsapp}
                onChange={(e) => mudar('whatsapp', e.target.value)}
              />
              <Campo
                id={idDoCampo('phone')}
                label="Telefone"
                inputMode="tel"
                maxLength={30}
                value={f.phone}
                erro={erros.phone}
                onChange={(e) => mudar('phone', e.target.value)}
              />
              <Selecao
                id={idDoCampo('price_range')}
                label="Faixa de preço"
                value={f.price_range}
                erro={erros.price_range}
                onChange={(e) => mudar('price_range', e.target.value as Faixa)}
              >
                <option value="">Não informada</option>
                <option value="$">$ · econômico</option>
                <option value="$$">$$ · moderado</option>
                <option value="$$$">$$$ · mais caro</option>
              </Selecao>
              <Campo
                id={idDoCampo('services')}
                label="Serviços"
                placeholder="Wi-Fi, café da manhã, Pix"
                value={f.services}
                erro={erros.services}
                onChange={(e) => mudar('services', e.target.value)}
              />
              <Caixa
                label="Parceiro do projeto"
                checked={f.is_partner}
                onChange={(e) => mudar('is_partner', e.target.checked)}
                className="admin-form__largo"
              />
              <div
                className="admin-form__largo admin-horarios"
                role="group"
                aria-labelledby="titulo-horarios"
              >
                <p id="titulo-horarios" className="rotulo">
                  Horário de funcionamento
                </p>
                <p className="campo__dica">
                  HH:MM-HH:MM; mais de uma faixa separada por vírgula. Vazio = fechado.
                </p>
                {erros.horarios && <p className="campo__erro">{erros.horarios}</p>}
                <div className="admin-horarios__dias">
                  {DIAS.map(([dia, nome]) => (
                    <Campo
                      key={dia}
                      id={idDoCampo(`horarios.${dia}`)}
                      label={nome}
                      placeholder="fechado"
                      value={f.horarios[dia] ?? ''}
                      erro={erros[`horarios.${dia}`]}
                      onChange={(e) => mudarHorario(dia, e.target.value)}
                    />
                  ))}
                </div>
              </div>
            </>
          )}
        </fieldset>

        <div className="admin-form__acoes">
          <Botao type="submit" carregando={enviando}>
            {atual ? 'Salvar alterações' : 'Criar local'}
          </Botao>
          <Link to="/admin/locais" className={classesBotao('secundario')}>
            Cancelar
          </Link>
        </div>
      </form>
    </section>
  )
}
