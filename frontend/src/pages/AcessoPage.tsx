import { useRef, useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation } from 'react-router'
import { useAuth } from '../auth/contexto'
import { destinoAposLogin } from '../auth/destino'
import { CascaAcesso } from '../components/CascaAcesso'
import { Botao } from '../components/ui/Botao'
import { Campo } from '../components/ui/Campo'
import { Card } from '../components/ui/Card'
import { ErroApi } from '../lib/api'
import { erroEmail, erroSenhaObrigatoria, primeiroComErro, type ErrosDe } from '../lib/validacao'

type CampoAcesso = 'email' | 'senha'
const ORDEM: readonly CampoAcesso[] = ['email', 'senha']

export function AcessoPage() {
  const { usuario, entrar, carregando } = useAuth()
  const local = useLocation()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erros, setErros] = useState<ErrosDe<CampoAcesso>>({})
  const [erroGeral, setErroGeral] = useState<string | null>(null)
  const refEmail = useRef<HTMLInputElement>(null)
  const refSenha = useRef<HTMLInputElement>(null)

  // Entrou (agora ou já estava): volta para onde a pessoa queria ir.
  if (usuario) return <Navigate to={destinoAposLogin(local.state)} replace />

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    setErroGeral(null)
    const novos: ErrosDe<CampoAcesso> = {}
    const e = erroEmail(email)
    const s = erroSenhaObrigatoria(senha)
    if (e) novos.email = e
    if (s) novos.senha = s
    setErros(novos)

    const primeiro = primeiroComErro(ORDEM, novos)
    if (primeiro) {
      const refs = { email: refEmail, senha: refSenha }
      refs[primeiro].current?.focus()
      return
    }

    try {
      await entrar(email.trim(), senha)
    } catch (erro) {
      setErroGeral(erro instanceof ErroApi ? erro.mensagem : 'Não foi possível entrar agora.')
    }
  }

  return (
    <CascaAcesso>
      <Card as="section" className="acesso__cartao" aria-labelledby="titulo-acesso">
        <h1 id="titulo-acesso" className="acesso__titulo">
          Entrar
        </h1>
        {erroGeral && (
          <p className="aviso-erro" role="alert">
            {erroGeral}
          </p>
        )}
        <form className="formulario" noValidate onSubmit={enviar}>
          <Campo
            ref={refEmail}
            label="E-mail"
            type="email"
            name="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(ev) => {
              setEmail(ev.target.value)
              if (erros.email) setErros({ ...erros, email: undefined })
            }}
            erro={erros.email}
          />
          <Campo
            ref={refSenha}
            label="Senha"
            type="password"
            name="senha"
            autoComplete="current-password"
            value={senha}
            onChange={(ev) => {
              setSenha(ev.target.value)
              if (erros.senha) setErros({ ...erros, senha: undefined })
            }}
            erro={erros.senha}
          />
          <Botao type="submit" className="botao--largo" carregando={carregando}>
            Entrar
          </Botao>
        </form>
        <p className="acesso__alternativa">
          Ainda não tem conta?{' '}
          <Link to="/criar-conta" state={local.state}>
            Criar conta
          </Link>
        </p>
      </Card>
    </CascaAcesso>
  )
}
