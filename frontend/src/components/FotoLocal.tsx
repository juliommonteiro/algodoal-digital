import { useState } from 'react'
import { urlDaFoto } from '../lib/formatos'
import type { Foto } from '../lib/tipos'
import { Icone } from './Icone'

export interface FotoLocalProps {
  foto: Foto | undefined
  nome: string
}

/** Foto principal do local; sem foto (ou se ela não carregar), mostra um substituto neutro. */
export function FotoLocal({ foto, nome }: FotoLocalProps) {
  const [falhou, setFalhou] = useState(false)
  const url = foto ? urlDaFoto(foto) : null

  if (!url || falhou) {
    return (
      <div className="foto foto--vazia" role="img" aria-label={`Ainda sem foto de ${nome}`}>
        <Icone nome="foto" tamanho={32} />
        <span className="rotulo">Sem foto ainda</span>
      </div>
    )
  }

  return (
    <img
      className="foto"
      src={url}
      alt={`Foto de ${nome}`}
      loading="lazy"
      onError={() => setFalhou(true)}
    />
  )
}
