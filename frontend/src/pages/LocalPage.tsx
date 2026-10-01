import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { FalhaCarga } from '../components/FalhaCarga'
import { FotoLocal } from '../components/FotoLocal'
import { Icone } from '../components/Icone'
import { Botao } from '../components/ui/Botao'
import { Card } from '../components/ui/Card'
import { Carregando } from '../components/ui/Carregando'
import { classesBotao } from '../components/ui/classes'
import { EstadoVazio } from '../components/ui/EstadoVazio'
import { Rotulo } from '../components/ui/Rotulo'
import { buscarLocal } from '../lib/catalogo'
import { porId } from '../lib/categorias'
import { api } from '../lib/cliente'
import {
  chaveDeHoje,
  coordenadas,
  DIAS,
  descricaoPreco,
  horarioDoDia,
  linkTelefone,
  linkWhatsApp,
  ROTULO_TIPO,
} from '../lib/formatos'
import type { Negocio } from '../lib/tipos'
import { useCarregar } from '../lib/useCarregar'

export function LocalPage() {
  const { id = '' } = useParams()
  const navegar = useNavigate()
  const local = useLocation()
  const carga = useCarregar(`local:${id}`, async () => {
    const [dados, categorias] = await Promise.all([buscarLocal(id), api.categorias()])
    return { local: dados, categoria: porId(categorias).get(dados.category_id) }
  })

  // Veio de dentro do app: "voltar" preserva os filtros da lista. Link direto: vai ao mapa.
  const voltar = () => (local.key !== 'default' ? navegar(-1) : navegar('/'))

  return (
    <section className="page detalhe">
      <button type="button" className="voltar" onClick={voltar}>
        <Icone nome="voltar" tamanho={20} />
        Voltar
      </button>

      {carga.status === 'carregando' && <Carregando itens={1} rotulo="Carregando local…" />}

      {carga.status === 'erro' &&
        (carga.erro.status === 404 ? (
          <EstadoVazio
            nivel="h1"
            icone={<Icone nome="pino" />}
            titulo="Local não encontrado"
            frase="Ele pode ter sido removido ou o link está errado."
            acao={
            <Link to="/" className={classesBotao('secundario')}>
              Voltar ao mapa
            </Link>
          }
          />
        ) : (
          <FalhaCarga erro={carga.erro} aoTentar={carga.recarregar} />
        ))}

      {carga.status === 'ok' && (
        <article className="detalhe__conteudo" aria-labelledby="titulo-local">
          <title>{`${carga.dados.local.name} · Algodoal Digital`}</title>
          <FotoLocal foto={carga.dados.local.photos[0]} nome={carga.dados.local.name} />

          <header className="detalhe__cabecalho">
            <Rotulo>
              {carga.dados.categoria?.name ?? ROTULO_TIPO[carga.dados.local.kind]}
            </Rotulo>
            <h1 id="titulo-local">{carga.dados.local.name}</h1>
            {carga.dados.local.business?.is_partner && (
              <p className="selo selo--destaque">
                <Icone nome="selo" tamanho={18} />
                Parceiro Algodoal Digital
              </p>
            )}
          </header>

          {carga.dados.local.description && (
            <p className="detalhe__descricao">{carga.dados.local.description}</p>
          )}

          {carga.dados.local.business && (
            <DadosComerciais negocio={carga.dados.local.business} nome={carga.dados.local.name} />
          )}

          <div className="detalhe__acoes">
            {/* S6: "Ver no mapa" centraliza o MapLibre neste ponto */}
            <Botao variante="secundario" className="botao--largo" disabled aria-describedby="nota-mapa">
              <Icone nome="mapa" tamanho={20} />
              Ver no mapa
            </Botao>
            <p id="nota-mapa" className="nota">
              O mapa da ilha chega na S6.
            </p>
          </div>

          <p className="detalhe__coordenadas">
            <Rotulo>Coordenadas</Rotulo>{' '}
            <span className="mono">
              {coordenadas(carga.dados.local.latitude, carga.dados.local.longitude)}
            </span>
          </p>
        </article>
      )}
    </section>
  )
}

function DadosComerciais({ negocio, nome }: { negocio: Negocio; nome: string }) {
  const hoje = chaveDeHoje()
  const preco = negocio.price_range ? descricaoPreco(negocio.price_range) : null
  const telefone = negocio.phone ?? negocio.whatsapp

  return (
    <>
      {negocio.whatsapp && (
        <a
          className={classesBotao('primario', 'botao--largo')}
          href={linkWhatsApp(negocio.whatsapp, nome)}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Icone nome="conversa" tamanho={20} />
          Chamar no WhatsApp
        </a>
      )}

      <Card as="section" className="detalhe__bloco" aria-labelledby="titulo-horario">
        <Rotulo as="h2" id="titulo-horario">
          Horário
        </Rotulo>
        {negocio.opening_hours ? (
          <dl className="horarios">
            {DIAS.map(([chave, dia]) => (
              <div key={chave} className={chave === hoje ? 'horarios__dia horarios__dia--hoje' : 'horarios__dia'}>
                <dt>
                  {dia}
                  {chave === hoje && <span className="so-leitor"> (hoje)</span>}
                </dt>
                <dd className="mono">{horarioDoDia(negocio.opening_hours, chave)}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p>Horário não informado.</p>
        )}
      </Card>

      {(negocio.price_range || negocio.services.length > 0) && (
        <Card as="section" className="detalhe__bloco" aria-labelledby="titulo-preco">
          <Rotulo as="h2" id="titulo-preco">
            Faixa de preço e serviços
          </Rotulo>
          {negocio.price_range && (
            <p>
              <span className="mono">{negocio.price_range}</span>
              {preco && <span className="detalhe__preco"> · {preco}</span>}
            </p>
          )}
          {negocio.services.length > 0 && (
            <ul className="etiquetas" aria-label="Serviços">
              {negocio.services.map((servico) => (
                <li key={servico}>{servico}</li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {telefone && (
        <Card as="section" className="detalhe__bloco" aria-labelledby="titulo-contato">
          <Rotulo as="h2" id="titulo-contato">
            Contato
          </Rotulo>
          <a className="contato" href={linkTelefone(telefone)}>
            <Icone nome="telefone" tamanho={20} />
            <span className="mono">{telefone}</span>
          </a>
        </Card>
      )}
    </>
  )
}
