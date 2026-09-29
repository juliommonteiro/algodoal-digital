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
  erroConfirmacao,
  erroEmail,
  erroNome,
  erroSenhaNova,
  primeiroComErro,
  SENHA_MINIMA,
  type ErrosDe,
} from '../lib/validacao'

type CampoCadastro = 'nome' | 'email' | 'senha' | 'confirmacao'
const ORDEM: readonly CampoCadastro[] = ['nome', 'email', 'senha', 'confirmacao']

export function CadastroPage() {
  const { usuario, registrar, carregando } = useAuth()
  const local = useLocation()
  const [valores, setValores] = useState<Record<CampoCadastro, string>>({
    nome: '',
    email: '',
    senha: '',
    confirmacao: '',
  })
  const [erros, setErros] = useState<ErrosDe<CampoCadastro>>({})
  const [erroGeral, setErroGeral] = useState<string | null>(null)
  const refNome = useRef<HTMLInputElement>(null)
  const refEmail = useRef<HTMLInputElement>(null)
  const refSenha = useRef<HTMLInputElement>(null)
  const refConfirmacao = useRef<HTMLInputElement>(null)

  if (usuario) return <Navigate to={destinoAposLogin(local.state)} replace />

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
    for (const [campo, erro] of checagens) if (erro) novos[campo] = erro
    setErros(novos)

    const primeiro = primeiroComErro(ORDEM, novos)
    if (primeiro) {
      const refs = { nome: refNome, email: refEmail, senha: refSenha, confirmacao: refConfirmacao }
      refs[primeiro].current?.focus()
      return
    }

    try {
      await registrar(valores.nome.trim(), valores.email.trim(), valores.senha)
    } catch (erro) {
      if (erro instanceof ErroApi && erro.status === 409) {
        setErros({ email: erro.mensagem })
        refEmail.current?.focus()
        return
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
