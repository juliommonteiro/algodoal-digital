import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { AreaDeTexto, Selecao } from '../admin/campos'
import { FalhaCarga } from '../components/FalhaCarga'
import { GerenciarFotos } from '../components/GerenciarFotos'
import { Botao } from '../components/ui/Botao'
import { Campo } from '../components/ui/Campo'
import { Card } from '../components/ui/Card'
import { Carregando } from '../components/ui/Carregando'
import { EstadoVazio } from '../components/ui/EstadoVazio'
import { Rotulo } from '../components/ui/Rotulo'
import { ErroApi } from '../lib/api'
import { porId } from '../lib/categorias'
import { api } from '../lib/cliente'
import { DIAS } from '../lib/formatos'
import {
  errosDosHorarios,
  horariosDosTextos,
  textosDosHorarios,
  type TextosDosHorarios,
} from '../lib/horarios'
import { clienteDeFotos } from '../lib/fotos'
import { parceiro } from '../lib/parceiro'
import type { Categoria, Local, NegocioDoParceiroEntrada } from '../lib/tipos'
import { useCarregar } from '../lib/useCarregar'

const fotosDoParceiro = clienteDeFotos('partner')

/** Painel do parceiro (protótipo 09): o dono edita o próprio estabelecimento. */
export function ParceiroPage() {
  const carga = useCarregar('parceiro', async () => {
    const [locais, categorias] = await Promise.all([parceiro.meus(), api.categorias()])
    return { locais, categorias }
  })
  const [escolhido, setEscolhido] = useState<string | null>(null)

  return (
    <section className="page parceiro" aria-labelledby="titulo-parceiro">
      <title>Perfil do negócio · Algodoal Digital</title>
      {carga.status === 'carregando' ? (
        <>
          <h1 id="titulo-parceiro" className="so-leitor">
            Perfil do negócio
          </h1>
          <Carregando rotulo="Carregando seu estabelecimento…" />
        </>
      ) : carga.status === 'erro' ? (
        <>
          <h1 id="titulo-parceiro" className="so-leitor">
            Perfil do negócio
          </h1>
          <FalhaCarga erro={carga.erro} aoTentar={carga.recarregar} />
        </>
      ) : carga.dados.locais.length === 0 ? (
        <EstadoVazio
          nivel="h1"
          titulo="Perfil do negócio"
          frase="Nenhum estabelecimento está ligado à sua conta ainda. Peça à equipe do Algodoal Digital para informar o seu e-mail como dono do estabelecimento."
        />
      ) : (
        <Painel
          locais={carga.dados.locais}
          categorias={carga.dados.categorias}
          escolhido={escolhido}
          aoEscolher={setEscolhido}
        />
      )}
    </section>
  )
}

function Painel({
  locais,
  categorias,
  escolhido,
  aoEscolher,
}: {
  locais: Local[]
  categorias: Categoria[]
  escolhido: string | null
  aoEscolher: (id: string) => void
}) {
  const local = locais.find((l) => l.id === escolhido) ?? locais[0]
  return (
    <>
      {locais.length > 1 && (
        <Selecao
          label="Estabelecimento"
          value={local.id}
          onChange={(e) => aoEscolher(e.target.value)}
        >
          {locais.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </Selecao>
      )}
      <Editor key={local.id} inicial={local} categoria={porId(categorias).get(local.category_id)} />
    </>
  )
}

// ---------------------------------------------------------------------------- edição

type Faixa = '' | '$' | '$$' | '$$$'

interface Formulario {
  description: string
  whatsapp: string
  phone: string
  price_range: Faixa
  services: string
  horarios: TextosDosHorarios
}

const ORDEM = [
  'description',
  'whatsapp',
  'phone',
  'price_range',
  'services',
  ...DIAS.map(([dia]) => `horarios.${dia}`),
]

function doLocal(local: Local): Formulario {
  const negocio = local.business
  return {
    description: local.description ?? '',
    whatsapp: negocio?.whatsapp ?? '',
    phone: negocio?.phone ?? '',
    price_range: (negocio?.price_range as Faixa | null) ?? '',
    services: negocio?.services.join(', ') ?? '',
    horarios: textosDosHorarios(negocio?.opening_hours ?? null),
  }
}

function paraEntrada(f: Formulario): Required<Omit<NegocioDoParceiroEntrada, 'is_published'>> {
  return {
    description: f.description.trim() || null,
    whatsapp: f.whatsapp.trim() || null,
    phone: f.phone.trim() || null,
    price_range: f.price_range || null,
    services: f.services
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    opening_hours: horariosDosTextos(f.horarios),
  }
}

/** PATCH leva só o que mudou. */
function mudancas(antes: Formulario, depois: Formulario): NegocioDoParceiroEntrada {
  const de = paraEntrada(antes)
  const para = paraEntrada(depois)
  const resultado: NegocioDoParceiroEntrada = {}
  for (const chave of Object.keys(para) as (keyof typeof para)[]) {
    if (JSON.stringify(de[chave]) !== JSON.stringify(para[chave])) {
      Object.assign(resultado, { [chave]: para[chave] })
    }
  }
  return resultado
}

/** "business.services.0" ou "opening_hours" (loc da API) → campo do formulário. */
function campoDaApi(caminho: string): string | null {
  const raiz = caminho.split('.')[0]
  if (raiz === 'opening_hours') return 'horarios.seg'
  return ORDEM.includes(raiz) ? raiz : null
}

const idDoCampo = (campo: string) => `parceiro-${campo.replace('.', '-')}`

function semCampo(erros: Record<string, string>, campo: string): Record<string, string> {
  return Object.fromEntries(Object.entries(erros).filter(([chave]) => chave !== campo))
}

function Editor({ inicial, categoria }: { inicial: Local; categoria: Categoria | undefined }) {
  const [local, setLocal] = useState(inicial)
  const [salvo, setSalvo] = useState(() => doLocal(inicial))
  const [f, setF] = useState(salvo)
  const [erros, setErros] = useState<Record<string, string>>({})
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [publicando, setPublicando] = useState(false)

  function mudar<C extends keyof Formulario>(campo: C, valor: Formulario[C]) {
    setF((atual) => ({ ...atual, [campo]: valor }))
    setAviso(null)
    if (erros[campo]) setErros((atuais) => semCampo(atuais, campo))
  }

  function mudarHorario(dia: string, valor: string) {
    setF((atual) => ({ ...atual, horarios: { ...atual.horarios, [dia]: valor } }))
    setAviso(null)
    const chave = `horarios.${dia}`
    if (erros[chave]) setErros((atuais) => semCampo(atuais, chave))
  }

  function focar(campos: Record<string, string>) {
    const primeiro = ORDEM.find((campo) => campos[campo])
    if (primeiro) document.getElementById(idDoCampo(primeiro))?.focus()
  }

  async function alternarPublicacao() {
    setPublicando(true)
    setAviso(null)
    try {
      setLocal(await parceiro.atualizar(local.id, { is_published: !local.is_published }))
    } catch (erro) {
      setAviso({
        tipo: 'erro',
        texto: erro instanceof ErroApi ? erro.mensagem : 'Não foi possível mudar agora.',
      })
    } finally {
      setPublicando(false)
    }
  }

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    setAviso(null)
    const novos = errosDosHorarios(f.horarios)
    setErros(novos)
    if (Object.keys(novos).length) return focar(novos)
    const corpo = mudancas(salvo, f)
    if (Object.keys(corpo).length === 0) {
      setAviso({ tipo: 'ok', texto: 'Nada mudou desde a última vez que você salvou.' })
      return
    }
    setEnviando(true)
    try {
      const atualizado = await parceiro.atualizar(local.id, corpo)
      setLocal(atualizado)
      const novo = doLocal(atualizado)
      setSalvo(novo)
      setF(novo)
      setAviso({
        tipo: 'ok',
        texto: atualizado.is_published
          ? 'Alterações salvas. Já aparecem no mapa e no diretório.'
          : 'Alterações salvas.',
      })
    } catch (erro) {
      if (erro instanceof ErroApi && erro.status === 422) {
        const daApi: Record<string, string> = {}
        for (const [caminho, msg] of Object.entries(erro.campos)) {
          const campo = campoDaApi(caminho)
          if (campo && !daApi[campo]) daApi[campo] = msg
        }
        if (Object.keys(daApi).length) {
          setErros(daApi)
          return focar(daApi)
        }
      }
      setAviso({
        tipo: 'erro',
        texto: erro instanceof ErroApi ? erro.mensagem : 'Não foi possível salvar agora.',
      })
    } finally {
      setEnviando(false)
    }
  }

  return (
    <>
      <header className="parceiro__cabecalho">
        <p className="page__eyebrow">Perfil do negócio</p>
        <h1 id="titulo-parceiro">{local.name}</h1>
      </header>

      {aviso && (
        <p
          className={aviso.tipo === 'ok' ? 'parceiro__aviso' : 'aviso-erro'}
          role={aviso.tipo === 'ok' ? 'status' : 'alert'}
        >
          {aviso.texto}
        </p>
      )}

      <Card className="carroceiro__perfil">
        <div>
          <p className="carroceiro__nome">
            {local.is_published ? 'No mapa e no diretório' : 'Fora do mapa'}
          </p>
          <p className="carroceiro__estado" id="estado-publicado">
            {local.is_published
              ? 'Turistas encontram seu estabelecimento.'
              : 'Ninguém vê seu estabelecimento até você ligar de novo.'}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          className="chave"
          aria-checked={local.is_published}
          aria-label="Aparece no mapa e no diretório"
          aria-describedby="estado-publicado"
          disabled={publicando}
          onClick={() => void alternarPublicacao()}
        >
          <span aria-hidden="true" />
        </button>
      </Card>

      <Card as="section" className="parceiro__fixos" aria-labelledby="titulo-fixos">
        <h2 id="titulo-fixos" className="so-leitor">
          Dados que a equipe mantém
        </h2>
        <dl>
          <div>
            <dt>
              <Rotulo>Categoria</Rotulo>
            </dt>
            <dd>{categoria?.name ?? '—'}</dd>
          </div>
          <div>
            <dt>
              <Rotulo>Localização</Rotulo>
            </dt>
            <dd>
              Marcada no mapa
              {local.is_published && (
                <>
                  {' · '}
                  <Link to={`/local/${local.id}`}>ver como o turista vê</Link>
                </>
              )}
            </dd>
          </div>
        </dl>
        <p className="campo__dica">
          Para mudar o nome, a categoria ou a posição no mapa, fale com a equipe do Algodoal Digital.
        </p>
      </Card>

      <Card className="parceiro__fotos">
        <GerenciarFotos
          localId={local.id}
          nome={local.name}
          fotos={local.photos}
          cliente={fotosDoParceiro}
          aoMudar={(photos) => setLocal((atual) => ({ ...atual, photos }))}
        />
      </Card>

      <form className="formulario parceiro__formulario" noValidate onSubmit={enviar}>
        <AreaDeTexto
          id={idDoCampo('description')}
          label="Descrição"
          maxLength={2000}
          value={f.description}
          erro={erros.description}
          onChange={(e) => mudar('description', e.target.value)}
        />
        <Campo
          id={idDoCampo('whatsapp')}
          label="WhatsApp"
          type="tel"
          inputMode="tel"
          placeholder="(91) 98888-7777"
          maxLength={30}
          value={f.whatsapp}
          erro={erros.whatsapp}
          onChange={(e) => mudar('whatsapp', e.target.value)}
        />
        <Campo
          id={idDoCampo('phone')}
          label="Telefone (opcional)"
          type="tel"
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
          <option value="">Não informar</option>
          <option value="$">$ · econômico</option>
          <option value="$$">$$ · intermediário</option>
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
        <p className="campo__dica">Separe os serviços por vírgula.</p>

        <fieldset className="parceiro__horarios">
          <legend>
            <Rotulo>Horário de funcionamento</Rotulo>
          </legend>
          <p className="campo__dica">
            HH:MM-HH:MM; mais de uma faixa separada por vírgula, ex.: 07:00-12:00, 14:00-21:00.
            Vazio = fechado.
          </p>
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
        </fieldset>

        <Botao type="submit" variante="grande" className="botao--largo" carregando={enviando}>
          Salvar alterações
        </Botao>
      </form>
    </>
  )
}
