import { useRef, useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation } from 'react-router'
import { useAuth } from '../auth/contexto'
import { destinoAposLogin } from '../auth/destino'
import { CascaAcesso } from '../components/CascaAcesso'
import { Botao } from '../components/ui/Botao'
import { Campo } from '../components/ui/Campo'
import { Card } from '../components/ui/Card'
import { ErroApi } from '../lib/api'
import {
  CAPACIDADE_MAXIMA,
  erroCapacidade,
  erroConfirmacao,
  erroEmail,
  erroNome,
  erroSenhaNova,
  erroWhatsApp,
  primeiroComErro,
  SENHA_MINIMA,
  type ErrosDe,
} from '../lib/validacao'

type CampoCadastro = 'nome' | 'email' | 'senha' | 'confirmacao' | 'whatsapp' | 'capacidade'
const ORDEM: readonly CampoCadastro[] = [
  'nome',
  'email',
  'senha',
  'confirmacao',
  'whatsapp',
  'capacidade',
]

// Erro de validação da API (422) no perfil de carroceiro: "carrier.whatsapp" → campo do formulário.
const CAMPOS_DA_API: Record<string, CampoCadastro> = {
  'carrier.whatsapp': 'whatsapp',
  'carrier.capacity': 'capacidade',
}

export function CadastroPage() {
  const { usuario, registrar, carregando } = useAuth()
  const local = useLocation()
  const [valores, setValores] = useState<Record<CampoCadastro, string>>({
    nome: '',
    email: '',
    senha: '',
    confirmacao: '',
    whatsapp: '',
    capacidade: '2',
  })
  const [carroceiro, setCarroceiro] = useState(false)
  const [erros, setErros] = useState<ErrosDe<CampoCadastro>>({})
  const [erroGeral, setErroGeral] = useState<string | null>(null)
  const refNome = useRef<HTMLInputElement>(null)
  const refEmail = useRef<HTMLInputElement>(null)
  const refSenha = useRef<HTMLInputElement>(null)
  const refConfirmacao = useRef<HTMLInputElement>(null)
  const refWhatsApp = useRef<HTMLInputElement>(null)
  const refCapacidade = useRef<HTMLInputElement>(null)
  const refs = {
    nome: refNome,
    email: refEmail,
    senha: refSenha,
    confirmacao: refConfirmacao,
    whatsapp: refWhatsApp,
    capacidade: refCapacidade,
  }

  // Carroceiro recém-cadastrado vai para a área dele, a menos que viesse de outra rota.
  if (usuario) {
    const padrao = usuario.role === 'carrier' ? '/carroceiro' : '/'
    return <Navigate to={destinoAposLogin(local.state, padrao)} replace />
  }

  function alterar(campo: CampoCadastro, valor: string) {
    setValores((atuais) => ({ ...atuais, [campo]: valor }))
    if (erros[campo]) setErros((atuais) => ({ ...atuais, [campo]: undefined }))
  }

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    setErroGeral(null)
    const novos: ErrosDe<CampoCadastro> = {}
    const checagens: [CampoCadastro, string | null][] = [
      ['nome', erroNome(valores.nome)],
      ['email', erroEmail(valores.email)],
      ['senha', erroSenhaNova(valores.senha)],
      ['confirmacao', erroConfirmacao(valores.senha, valores.confirmacao)],
    ]
    if (carroceiro) {
      checagens.push(
        ['whatsapp', erroWhatsApp(valores.whatsapp)],
        ['capacidade', erroCapacidade(valores.capacidade)],
      )
    }
    for (const [campo, erro] of checagens) if (erro) novos[campo] = erro
    setErros(novos)

    const primeiro = primeiroComErro(ORDEM, novos)
    if (primeiro) {
      refs[primeiro].current?.focus()
      return
    }

    try {
      await registrar(
        valores.nome.trim(),
        valores.email.trim(),
        valores.senha,
        carroceiro
          ? { whatsapp: valores.whatsapp.trim(), capacity: Number(valores.capacidade) }
          : undefined,
      )
    } catch (erro) {
      if (erro instanceof ErroApi && erro.status === 409) {
        setErros({ email: erro.mensagem })
        refEmail.current?.focus()
        return
      }
      if (erro instanceof ErroApi && erro.status === 422) {
        const daApi: ErrosDe<CampoCadastro> = {}
        for (const [caminho, campo] of Object.entries(CAMPOS_DA_API)) {
          if (erro.campos[caminho]) daApi[campo] = erro.campos[caminho]
        }
        const primeiroDaApi = primeiroComErro(ORDEM, daApi)
        if (primeiroDaApi) {
          setErros(daApi)
          refs[primeiroDaApi].current?.focus()
          return
        }
      }
      setErroGeral(erro instanceof ErroApi ? erro.mensagem : 'Não foi possível criar a conta agora.')
    }
  }

  return (
    <CascaAcesso>
      <Card as="section" className="acesso__cartao" aria-labelledby="titulo-cadastro">
        <h1 id="titulo-cadastro" className="acesso__titulo">
          Criar conta
        </h1>
        {erroGeral && (
          <p className="aviso-erro" role="alert">
            {erroGeral}
          </p>
        )}
        <form className="formulario" noValidate onSubmit={enviar}>
          <Campo
            ref={refNome}
            label="Nome"
            name="nome"
            autoComplete="name"
            value={valores.nome}
            onChange={(ev) => alterar('nome', ev.target.value)}
            erro={erros.nome}
          />
          <Campo
            ref={refEmail}
            label="E-mail"
            type="email"
            name="email"
            autoComplete="email"
            inputMode="email"
            value={valores.email}
            onChange={(ev) => alterar('email', ev.target.value)}
            erro={erros.email}
          />
          <Campo
            ref={refSenha}
            label={`Senha (mínimo ${SENHA_MINIMA} caracteres)`}
            type="password"
            name="senha"
            autoComplete="new-password"
            value={valores.senha}
            onChange={(ev) => alterar('senha', ev.target.value)}
            erro={erros.senha}
          />
          <Campo
            ref={refConfirmacao}
            label="Repita a senha"
            type="password"
            name="confirmacao"
            autoComplete="new-password"
            value={valores.confirmacao}
            onChange={(ev) => alterar('confirmacao', ev.target.value)}
            erro={erros.confirmacao}
          />

          <div className="cadastro__opcao">
            <input
              id="cadastro-carroceiro"
              type="checkbox"
              className="cadastro__caixa"
              checked={carroceiro}
              onChange={(ev) => setCarroceiro(ev.target.checked)}
              aria-describedby="cadastro-carroceiro-dica"
            />
            <label htmlFor="cadastro-carroceiro" className="cadastro__rotulo">
              Sou carroceiro e quero receber pedidos
            </label>
            <p id="cadastro-carroceiro-dica" className="cadastro__dica">
              Seu perfil de carroceiro fica ativo na hora, sem aprovação.
            </p>
          </div>

          {carroceiro && (
            <>
              <Campo
                ref={refWhatsApp}
                label="WhatsApp com DDD"
                type="tel"
                name="whatsapp"
                autoComplete="tel"
                inputMode="tel"
                placeholder="(91) 98888-7777"
                value={valores.whatsapp}
                onChange={(ev) => alterar('whatsapp', ev.target.value)}
                erro={erros.whatsapp}
              />
              <Campo
                ref={refCapacidade}
                label="Quantas pessoas cabem na carroça"
                type="number"
                name="capacidade"
                inputMode="numeric"
                min={1}
                max={CAPACIDADE_MAXIMA}
                value={valores.capacidade}
                onChange={(ev) => alterar('capacidade', ev.target.value)}
                erro={erros.capacidade}
              />
            </>
          )}

          <Botao type="submit" className="botao--largo" carregando={carregando}>
            Criar conta
          </Botao>
        </form>
        <p className="acesso__alternativa">
          Já tem conta?{' '}
          <Link to="/entrar" state={local.state}>
            Entrar
          </Link>
        </p>
      </Card>
    </CascaAcesso>
  )
}
