import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { definirRenovador, definirTokenAcesso, ErroApi, obterTokenAcesso } from '../lib/api'
import { api } from '../lib/cliente'
import type { DadosCarroceiro, RespostaLogin, Usuario } from '../lib/tipos'
import { AuthContexto, type ValorAuth } from './contexto'
import { apagarSessao, CHAVE_SESSAO, gravarSessao, lerSessao, type SessaoSalva } from './sessao'

/**
 * Sessão offline-first:
 * - abre com o que está no localStorage, sem esperar a rede (o passaporte abre offline);
 * - com rede, renova o token de acesso em segundo plano;
 * - 401 na renovação encerra a sessão; falha de rede mantém a sessão local e tenta de novo
 *   quando o navegador avisar que voltou a conexão.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [sessao, setSessao] = useState<SessaoSalva | null>(lerSessao)
  const [carregando, setCarregando] = useState(false)
  // Evita duas renovações simultâneas (StrictMode monta o efeito duas vezes, e com refresh
  // token rotativo a segunda chamada usaria um token já invalidado).
  const renovando = useRef<Promise<boolean> | null>(null)

  const aplicar = useCallback((resposta: RespostaLogin): Usuario => {
    definirTokenAcesso(resposta.access_token)
    const nova = { refresh_token: resposta.refresh_token, user: resposta.user }
    gravarSessao(nova)
    setSessao(nova)
    return resposta.user
  }, [])

  const sair = useCallback(() => {
    definirTokenAcesso(null)
    apagarSessao()
    setSessao(null)
  }, [])

  const refreshToken = sessao?.refresh_token ?? null

  /** Uma renovação por vez; true se saiu com um token de acesso novo. */
  const renovarSessao = useCallback((): Promise<boolean> => {
    if (renovando.current) return renovando.current
    const tokenUsado = lerSessao()?.refresh_token
    if (!tokenUsado || !navigator.onLine) return Promise.resolve(false)
    renovando.current = api
      .renovar(tokenUsado)
      .then(
        (resposta) => {
          // Se a pessoa saiu (ou entrou com outra conta) enquanto isso, ignora a resposta.
          if (lerSessao()?.refresh_token !== tokenUsado) return obterTokenAcesso() !== null
          aplicar(resposta)
          return true
        },
        (erro: unknown) => {
          if (
            erro instanceof ErroApi &&
            erro.status === 401 &&
            lerSessao()?.refresh_token === tokenUsado
          ) {
            sair()
          }
          // Qualquer outra falha (sem rede, 5xx): mantém a sessão local.
          return false
        },
      )
      .finally(() => {
        renovando.current = null
      })
    return renovando.current
  }, [aplicar, sair])

  // Layout, não efeito comum: os efeitos das telas (filhas) rodam antes dos do provider, e a
  // primeira chamada delas já precisa achar o renovador registrado.
  useLayoutEffect(() => {
    definirRenovador(renovarSessao)
    return () => definirRenovador(null)
  }, [renovarSessao])

  useEffect(() => {
    if (!refreshToken) return
    const renovarSeFaltar = () => {
      if (!obterTokenAcesso()) void renovarSessao()
    }
    renovarSeFaltar()
    window.addEventListener('online', renovarSeFaltar)
    return () => window.removeEventListener('online', renovarSeFaltar)
  }, [refreshToken, renovarSessao])

  // Entrou ou saiu em outra aba: acompanha.
  useEffect(() => {
    function aoMudarStorage(evento: StorageEvent) {
      if (evento.key !== null && evento.key !== CHAVE_SESSAO) return
      const lida = lerSessao()
      if (!lida) definirTokenAcesso(null)
      setSessao(lida)
    }
    window.addEventListener('storage', aoMudarStorage)
    return () => window.removeEventListener('storage', aoMudarStorage)
  }, [])

  const entrar = useCallback(
    async (email: string, senha: string) => {
      setCarregando(true)
      try {
        return aplicar(await api.entrar(email, senha))
      } finally {
        setCarregando(false)
      }
    },
    [aplicar],
  )

  const registrar = useCallback(
    async (nome: string, email: string, senha: string, carroceiro?: DadosCarroceiro) => {
      setCarregando(true)
      try {
        return aplicar(await api.registrar(nome, email, senha, carroceiro))
      } finally {
        setCarregando(false)
      }
    },
    [aplicar],
  )

  const valor = useMemo<ValorAuth>(
    () => ({ usuario: sessao?.user ?? null, carregando, entrar, registrar, sair }),
    [sessao, carregando, entrar, registrar, sair],
  )

  return <AuthContexto.Provider value={valor}>{children}</AuthContexto.Provider>
}
