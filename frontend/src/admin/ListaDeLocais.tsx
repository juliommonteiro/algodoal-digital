import { useMemo, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router'
import { FalhaCarga } from '../components/FalhaCarga'
import { Botao } from '../components/ui/Botao'
import { Campo } from '../components/ui/Campo'
import { Carregando } from '../components/ui/Carregando'
import { classesBotao } from '../components/ui/classes'
import { EstadoVazio } from '../components/ui/EstadoVazio'
import { ErroApi } from '../lib/api'
import { porId } from '../lib/categorias'
import { normalizar, ROTULO_TIPO } from '../lib/formatos'
import type { FiltrosAdmin, LocalAdmin, StatusAdmin, TipoLocal } from '../lib/tipos'
import { useCarregar } from '../lib/useCarregar'
import { apiAdmin, statusDoLocal } from './cliente'
import { Selecao } from './campos'
import { CaixaDeAviso, type Aviso } from './aviso'
import { opcoesDeCategoria, ROTULO_STATUS } from './opcoes'

const TIPOS = Object.entries(ROTULO_TIPO) as [TipoLocal, string][]
const STATUS = Object.entries(ROTULO_STATUS) as [StatusAdmin, string][]

function useFiltrosAdmin() {
  const [params, setParams] = useSearchParams()
  const definir = (chave: string, valor: string) =>
    setParams(
      (atuais) => {
        const novos = new URLSearchParams(atuais)
        if (valor) novos.set(chave, valor)
        else novos.delete(chave)
        return novos
      },
      { replace: true },
    )
  const filtros: FiltrosAdmin = {
    category: params.get('categoria') || undefined,
    kind: (params.get('tipo') as TipoLocal) || undefined,
    status: (params.get('status') as StatusAdmin) || undefined,
  }
  return { filtros, busca: params.get('q') ?? '', definir }
}

export function ListaDeLocais() {
  const { filtros, busca, definir } = useFiltrosAdmin()
  const local = useLocation()
  // Recado deixado pelo formulário ao salvar ("Local criado.").
  const [aviso, setAviso] = useState<Aviso | null>(
    (local.state as { aviso?: Aviso } | null)?.aviso ?? null,
  )
  const [ocupado, setOcupado] = useState<string | null>(null)

  const categorias = useCarregar('categorias', () => apiAdmin.categorias())
  const chave = JSON.stringify(filtros)
  const locais = useCarregar(chave, () => apiAdmin.locais(filtros))
  // Linhas alteradas aqui (remover/restaurar) sem recarregar a lista: a linha removida fica
  // onde estava, esmaecida e com "Restaurar" à mão, mesmo com um filtro de status ativo.
  const [alterados, setAlterados] = useState<{
    chave: string
    porId: Record<string, LocalAdmin>
  }>({
    chave,
    porId: {},
  })

  const nomesDasCategorias = useMemo(
    () => (categorias.status === 'ok' ? porId(categorias.dados) : new Map()),
    [categorias],
  )

  const linhas = useMemo(() => {
    if (locais.status !== 'ok') return []
    const mudados = alterados.chave === chave ? alterados.porId : {}
    const termo = normalizar(busca)
    return locais.dados
      .map((l) => mudados[l.id] ?? l)
      .filter((l) => !termo || normalizar(l.name).includes(termo))
  }, [locais, alterados, chave, busca])

  async function executar(alvo: LocalAdmin, acao: 'remover' | 'restaurar') {
    if (
      acao === 'remover' &&
      !window.confirm(
        `Remover "${alvo.name}"?\n\nO local some do mapa público, mas continua aqui no painel e pode ser restaurado.`,
      )
    ) {
      return
    }
    setOcupado(alvo.id)
    setAviso(null)
    try {
      const atualizado =
        acao === 'remover' ? await apiAdmin.remover(alvo.id) : await apiAdmin.restaurar(alvo.id)
      setAlterados((atual) => ({
        chave,
        porId: {
          ...(atual.chave === chave ? atual.porId : {}),
          [atualizado.id]: atualizado,
        },
      }))
      setAviso({
        tipo: 'sucesso',
        texto:
          acao === 'remover'
            ? `"${alvo.name}" foi removido do mapa público.`
            : `"${alvo.name}" foi restaurado${atualizado.is_published ? ' e voltou ao mapa' : ' (continua como rascunho)'}.`,
      })
    } catch (erro) {
      const mensagem = erro instanceof ErroApi ? erro.mensagem : 'Algo deu errado.'
      setAviso({
        tipo: 'erro',
        texto: `Não foi possível ${acao} "${alvo.name}": ${mensagem}`,
      })
    } finally {
      setOcupado(null)
    }
  }

  return (
    <section aria-labelledby="titulo-locais">
      <title>Locais · Painel · Algodoal Digital</title>
      <header className="admin__cabecalho">
        <div>
          <h1 id="titulo-locais">Locais</h1>
          <p className="admin__intro">
            Praias, trilhas, pontos e estabelecimentos — inclusive rascunhos e removidos.
          </p>
        </div>
        <Link to="/admin/locais/novo" className={classesBotao('primario')}>
          Novo local
        </Link>
      </header>

      <CaixaDeAviso aviso={aviso} />

      <div className="admin-filtros" role="search" aria-label="Filtrar locais">
        <Campo
          label="Buscar pelo nome"
          type="search"
          value={busca}
          placeholder="Ex.: pousada"
          onChange={(e) => definir('q', e.target.value)}
          className="admin-filtros__busca"
        />
        <Selecao
          label="Categoria"
          value={filtros.category ?? ''}
          onChange={(e) => definir('categoria', e.target.value)}
        >
          <option value="">Todas</option>
          {categorias.status === 'ok' &&
            opcoesDeCategoria(categorias.dados).map(({ categoria, rotulo }) => (
              <option key={categoria.id} value={categoria.slug}>
                {rotulo}
              </option>
            ))}
        </Selecao>
        <Selecao
          label="Tipo"
          value={filtros.kind ?? ''}
          onChange={(e) => definir('tipo', e.target.value)}
        >
          <option value="">Todos</option>
          {TIPOS.map(([valor, rotulo]) => (
            <option key={valor} value={valor}>
              {rotulo}
            </option>
          ))}
        </Selecao>
        <Selecao
          label="Status"
          value={filtros.status ?? ''}
          onChange={(e) => definir('status', e.target.value)}
        >
          <option value="">Todos</option>
          {STATUS.map(([valor, rotulo]) => (
            <option key={valor} value={valor}>
              {rotulo}
            </option>
          ))}
        </Selecao>
      </div>

      {locais.status === 'carregando' && <Carregando rotulo="Carregando locais…" />}
      {locais.status === 'erro' && <FalhaCarga erro={locais.erro} aoTentar={locais.recarregar} />}
      {locais.status === 'ok' && linhas.length === 0 && (
        <EstadoVazio
          titulo="Nenhum local encontrado"
          frase="Nenhum local com esses filtros. Mude a busca ou os filtros, ou cadastre um novo."
        />
      )}
      {linhas.length > 0 && (
        <div className="admin-tabela__rolagem">
          <table className="admin-tabela">
            <caption className="so-leitor">
              {linhas.length === 1 ? '1 local' : `${linhas.length} locais`}
            </caption>
            <thead>
              <tr>
                <th scope="col">Nome</th>
                <th scope="col">Categoria</th>
                <th scope="col">Tipo</th>
                <th scope="col">Status</th>
                <th scope="col">
                  <span className="so-leitor">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => {
                const status = statusDoLocal(l)
                return (
                  <tr
                    key={l.id}
                    className={status === 'removido' ? 'admin-tabela__removido' : undefined}
                  >
                    <th scope="row">
                      <Link to={`/admin/locais/${l.id}`} className="admin-tabela__nome">
                        {l.name}
                      </Link>
                    </th>
                    <td>{nomesDasCategorias.get(l.category_id)?.name ?? '—'}</td>
                    <td>{ROTULO_TIPO[l.kind]}</td>
                    <td>
                      <span className={`admin-status admin-status--${status}`}>
                        {ROTULO_STATUS[status]}
                      </span>
                    </td>
                    <td>
                      <div className="admin-tabela__acoes">
                        {status === 'removido' ? (
                          <Botao
                            variante="secundario"
                            className="botao--pequeno"
                            carregando={ocupado === l.id}
                            onClick={() => executar(l, 'restaurar')}
                            aria-label={`Restaurar ${l.name}`}
                          >
                            Restaurar
                          </Botao>
                        ) : (
                          <>
                            <Link
                              to={`/admin/locais/${l.id}`}
                              className={classesBotao('secundario', 'botao--pequeno')}
                              aria-label={`Editar ${l.name}`}
                            >
                              Editar
                            </Link>
                            <Botao
                              variante="secundario"
                              className="botao--pequeno botao--perigo"
                              carregando={ocupado === l.id}
                              onClick={() => executar(l, 'remover')}
                              aria-label={`Remover ${l.name}`}
                            >
                              Remover
                            </Botao>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
