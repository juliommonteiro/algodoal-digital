import { useId, useRef, useState, type ChangeEvent } from 'react'
import { ErroApi } from '../lib/api'
import { LIMITE_DE_FOTOS, prepararFoto, type ClienteFotos } from '../lib/fotos'
import { urlDaFoto } from '../lib/formatos'
import type { Foto } from '../lib/tipos'
import { Icone } from './Icone'
import { Botao } from './ui/Botao'
import { Rotulo } from './ui/Rotulo'

export interface GerenciarFotosProps {
  localId: string
  nome: string
  fotos: Foto[]
  /** Cliente do painel (admin ou parceiro): a API decide quem mexe em qual local. */
  cliente: ClienteFotos
  aoMudar?: (fotos: Foto[]) => void
}

/** Envia, apaga e escolhe a capa (#29). Cada ação vale na hora, fora do "Salvar" do formulário. */
export function GerenciarFotos({ localId, nome, fotos: iniciais, cliente, aoMudar }: GerenciarFotosProps) {
  const [fotos, setFotos] = useState(iniciais)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)
  const entrada = useRef<HTMLInputElement>(null)
  const idEntrada = useId()
  const cheio = fotos.length >= LIMITE_DE_FOTOS

  async function executar(chave: string, acao: () => Promise<Foto[]>, sucesso: string) {
    setOcupado(chave)
    setAviso(null)
    try {
      const novas = await acao()
      setFotos(novas)
      aoMudar?.(novas)
      setAviso({ tipo: 'ok', texto: sucesso })
    } catch (erro) {
      setAviso({
        tipo: 'erro',
        texto: erro instanceof ErroApi ? erro.mensagem : 'Não foi possível mexer nas fotos agora.',
      })
    } finally {
      setOcupado(null)
    }
  }

  async function aoEscolher(evento: ChangeEvent<HTMLInputElement>) {
    const arquivo = evento.target.files?.[0]
    evento.target.value = '' // escolher a mesma foto de novo dispara outra vez
    if (!arquivo) return
    await executar(
      'enviar',
      async () => cliente.enviar(localId, await prepararFoto(arquivo)),
      'Foto enviada.',
    )
  }

  function apagar(foto: Foto, numero: number) {
    if (!window.confirm(`Apagar a foto ${numero} de ${nome}? Não dá para desfazer.`)) return
    void executar(`apagar:${foto.id}`, () => cliente.apagar(localId, foto.id), 'Foto apagada.')
  }

  return (
    <section className="fotos" aria-labelledby={`${idEntrada}-titulo`}>
      <div className="fotos__topo">
        <Rotulo as="h2" id={`${idEntrada}-titulo`}>
          Fotos ({fotos.length} de {LIMITE_DE_FOTOS})
        </Rotulo>
      </div>
      <p className="campo__dica">
        A primeira é a capa: é a que o turista vê no detalhe do local. JPG, PNG ou WebP; o app
        reduz a foto antes de enviar.
      </p>

      {aviso && (
        <p className={aviso.tipo === 'ok' ? 'fotos__aviso' : 'aviso-erro'} role={aviso.tipo === 'ok' ? 'status' : 'alert'}>
          {aviso.texto}
        </p>
      )}

      {fotos.length > 0 && (
        <ul className="fotos__lista">
          {fotos.map((foto, indice) => (
            <Miniatura
              key={foto.id}
              foto={foto}
              numero={indice + 1}
              nome={nome}
              ocupado={ocupado}
              aoTornarCapa={() =>
                void executar(
                  `capa:${foto.id}`,
                  () => cliente.tornarCapa(localId, foto.id),
                  'Capa trocada.',
                )
              }
              aoApagar={() => apagar(foto, indice + 1)}
            />
          ))}
        </ul>
      )}

      <input
        ref={entrada}
        id={idEntrada}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="so-leitor"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(evento) => void aoEscolher(evento)}
      />
      <Botao
        variante="secundario"
        className="botao--largo"
        carregando={ocupado === 'enviar'}
        disabled={cheio || ocupado !== null}
        onClick={() => entrada.current?.click()}
      >
        <Icone nome="foto" tamanho={20} />
        {cheio ? `Limite de ${LIMITE_DE_FOTOS} fotos` : 'Adicionar foto'}
      </Botao>
    </section>
  )
}

function Miniatura({
  foto,
  numero,
  nome,
  ocupado,
  aoTornarCapa,
  aoApagar,
}: {
  foto: Foto
  numero: number
  nome: string
  ocupado: string | null
  aoTornarCapa: () => void
  aoApagar: () => void
}) {
  const [falhou, setFalhou] = useState(false)
  const url = urlDaFoto(foto)
  const capa = numero === 1
  return (
    <li className="fotos__item">
      {url && !falhou ? (
        <img
          src={url}
          alt={`Foto ${numero} de ${nome}`}
          loading="lazy"
          onError={() => setFalhou(true)}
        />
      ) : (
        <div className="fotos__vazia" role="img" aria-label={`Foto ${numero} de ${nome}`}>
          <Icone nome="foto" tamanho={24} />
        </div>
      )}
      {capa && <span className="fotos__capa">Capa</span>}
      <div className="fotos__acoes">
        {!capa && (
          <button
            type="button"
            className="carroca__link"
            disabled={ocupado !== null}
            aria-label={`Usar a foto ${numero} como capa`}
            onClick={aoTornarCapa}
          >
            Usar como capa
          </button>
        )}
        <button
          type="button"
          className="carroca__link"
          disabled={ocupado !== null}
          aria-label={`Apagar a foto ${numero}`}
          onClick={aoApagar}
        >
          Apagar
        </button>
      </div>
    </li>
  )
}
