import { useCallback, useEffect, useRef, useState } from 'react'
import { ErroApi } from './api'

export type EstadoCarga<T> =
  | { status: 'carregando' }
  | { status: 'ok'; dados: T }
  | { status: 'erro'; erro: ErroApi }

interface Resultado<T> {
  chave: string
  tentativa: number
  estado: EstadoCarga<T>
}

/**
 * Carrega dados do cliente de API. `chave` identifica o que está sendo carregado (ex.: o id
 * do local): mudou a chave, volta a "carregando" e resposta atrasada da chave anterior é
 * descartada. Erro inesperado também vira ErroApi, para a tela ter um único formato.
 */
export function useCarregar<T>(
  chave: string,
  carregar: () => Promise<T>,
): EstadoCarga<T> & { recarregar: () => void } {
  const [tentativa, setTentativa] = useState(0)
  const [resultado, setResultado] = useState<Resultado<T> | null>(null)
  const carregarRef = useRef(carregar)

  useEffect(() => {
    carregarRef.current = carregar
  })

  useEffect(() => {
    let ativo = true
    carregarRef.current().then(
      (dados) => {
        if (ativo) setResultado({ chave, tentativa, estado: { status: 'ok', dados } })
      },
      (erro: unknown) => {
        const erroApi =
          erro instanceof ErroApi ? erro : new ErroApi(-1, 'Algo deu errado ao carregar.')
        if (ativo) setResultado({ chave, tentativa, estado: { status: 'erro', erro: erroApi } })
      },
    )
    return () => {
      ativo = false
    }
  }, [chave, tentativa])

  const recarregar = useCallback(() => setTentativa((t) => t + 1), [])

  const atual: EstadoCarga<T> =
    resultado && resultado.chave === chave && resultado.tentativa === tentativa
      ? resultado.estado
      : { status: 'carregando' }

  return { ...atual, recarregar }
}
