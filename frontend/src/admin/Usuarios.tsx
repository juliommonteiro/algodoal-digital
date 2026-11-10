import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { useAuth } from '../auth/contexto'
import { FalhaCarga } from '../components/FalhaCarga'
import { Botao } from '../components/ui/Botao'
import { Campo } from '../components/ui/Campo'
import { Carregando } from '../components/ui/Carregando'
import { EstadoVazio } from '../components/ui/EstadoVazio'
import { ErroApi } from '../lib/api'
import { normalizar } from '../lib/formatos'
import type { FiltrosUsuarios, Perfil, StatusConta, UsuarioAdmin, UsuarioAdminEntrada } from '../lib/tipos'
import { useCarregar } from '../lib/useCarregar'
import { CaixaDeAviso, type Aviso } from './aviso'
import { Selecao } from './campos'
import { apiAdmin } from './cliente'
import { ROTULO_PERFIL } from './opcoes'

const PERFIS = Object.entries(ROTULO_PERFIL) as [Perfil, string][]
const criadoEm = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })

function useFiltros() {
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
  const filtros: FiltrosUsuarios = {
    perfil: (params.get('perfil') as Perfil) || undefined,
    status: (params.get('status') as StatusConta) || undefined,
  }
  return { filtros, busca: params.get('q') ?? '', definir }
}

/** Contas do app: desativar/reativar e alternar entre turista e admin. */
export function Usuarios() {
  const { usuario: eu } = useAuth()
  const { filtros, busca, definir } = useFiltros()
  const chave = `usuarios:${JSON.stringify(filtros)}`
  const carga = useCarregar(chave, () => apiAdmin.usuarios(filtros))
  const [alterados, setAlterados] = useState<Record<string, UsuarioAdmin>>({})
  const [aviso, setAviso] = useState<Aviso | null>(null)
  const [ocupado, setOcupado] = useState<string | null>(null)

  const linhas = useMemo(() => {
    if (carga.status !== 'ok') return []
    const termo = normalizar(busca)
    return carga.dados
      .map((u) => alterados[u.id] ?? u)
      .filter((u) => !termo || normalizar(`${u.name} ${u.email}`).includes(termo))
  }, [carga, alterados, busca])

  async function mudar(alvo: UsuarioAdmin, mudancas: UsuarioAdminEntrada, pergunta: string, feito: string) {
    if (!window.confirm(pergunta)) return
    setOcupado(alvo.id)
    setAviso(null)
    try {
      const atualizado = await apiAdmin.atualizarUsuario(alvo.id, mudancas)
      setAlterados((atuais) => ({ ...atuais, [atualizado.id]: atualizado }))
      setAviso({ tipo: 'sucesso', texto: feito })
    } catch (erro) {
      setAviso({
        tipo: 'erro',
        texto: `Não foi possível mudar "${alvo.name}": ${erro instanceof ErroApi ? erro.mensagem : 'algo deu errado.'}`,
      })
    } finally {
      setOcupado(null)
    }
  }

  return (
    <section aria-labelledby="titulo-usuarios">
      <title>Usuários · Painel · Algodoal Digital</title>
      <header className="admin__cabecalho">
        <div>
          <h1 id="titulo-usuarios">Usuários</h1>
          <p className="admin__intro">
            Todas as contas do app. Desativar tira a pessoa de todos os aparelhos na hora. Carroceiro
            e parceiro vêm do cadastro e do dono do estabelecimento; aqui só se alterna turista e admin.
          </p>
        </div>
      </header>

      <CaixaDeAviso aviso={aviso} />

      <div className="admin-filtros admin-filtros--tres" role="search" aria-label="Filtrar usuários">
        <Campo
          label="Buscar por nome ou e-mail"
          type="search"
          value={busca}
          onChange={(e) => definir('q', e.target.value)}
          className="admin-filtros__busca"
        />
        <Selecao label="Perfil" value={filtros.perfil ?? ''} onChange={(e) => definir('perfil', e.target.value)}>
          <option value="">Todos</option>
          {PERFIS.map(([valor, rotulo]) => (
            <option key={valor} value={valor}>
              {rotulo}
            </option>
          ))}
        </Selecao>
        <Selecao label="Situação" value={filtros.status ?? ''} onChange={(e) => definir('status', e.target.value)}>
          <option value="">Todas</option>
          <option value="ativa">Ativa</option>
          <option value="desativada">Desativada</option>
        </Selecao>
      </div>

      {carga.status === 'carregando' && <Carregando rotulo="Carregando usuários…" />}
      {carga.status === 'erro' && <FalhaCarga erro={carga.erro} aoTentar={carga.recarregar} />}
      {carga.status === 'ok' && linhas.length === 0 && (
        <EstadoVazio titulo="Nenhum usuário encontrado" frase="Mude a busca ou os filtros." />
      )}
      {linhas.length > 0 && (
        <div className="admin-tabela__rolagem">
          <table className="admin-tabela">
            <caption className="so-leitor">
              {linhas.length === 1 ? '1 usuário' : `${linhas.length} usuários`}
            </caption>
            <thead>
              <tr>
                <th scope="col">Nome</th>
                <th scope="col">E-mail</th>
                <th scope="col">Perfil</th>
                <th scope="col">Situação</th>
                <th scope="col">
                  <span className="so-leitor">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((u) => {
                const souEu = u.id === eu?.id
                return (
                  <tr key={u.id} className={u.is_active ? undefined : 'admin-tabela__removido'}>
                    <th scope="row">
                      <span className="admin-tabela__nome">{u.name}</span>
                      {souEu && <span className="admin-tag">você</span>}
                      <span className="admin-tabela__sub">desde {criadoEm.format(new Date(u.created_at))}</span>
                    </th>
                    <td>{u.email}</td>
                    <td>
                      {ROTULO_PERFIL[u.role]}
                      {u.role === 'partner' && (
                        <span className="admin-tabela__sub">
                          {u.estabelecimentos === 0
                            ? 'nenhum estabelecimento'
                            : u.estabelecimentos === 1
                              ? '1 estabelecimento'
                              : `${u.estabelecimentos} estabelecimentos`}
                        </span>
                      )}
                    </td>
                    <td>
                      <span className={`admin-status admin-status--${u.is_active ? 'publicado' : 'removido'}`}>
                        {u.is_active ? 'Ativa' : 'Desativada'}
                      </span>
                    </td>
                    <td>
                      {souEu ? (
                        <span className="admin-tabela__sub">Sua conta</span>
                      ) : (
                        <div className="admin-tabela__acoes">
                          {(u.role === 'tourist' || u.role === 'admin') && u.is_active && (
                            <Botao
                              variante="secundario"
                              className="botao--pequeno"
                              disabled={ocupado !== null}
                              aria-label={u.role === 'admin' ? `Tirar admin de ${u.name}` : `Tornar ${u.name} admin`}
                              onClick={() =>
                                u.role === 'admin'
                                  ? mudar(u, { role: 'tourist' }, `Tirar o acesso de admin de "${u.name}"? A conta volta a ser de turista.`, `"${u.name}" não é mais admin.`)
                                  : mudar(u, { role: 'admin' }, `Tornar "${u.name}" admin? A pessoa passa a ver e mudar tudo neste painel.`, `"${u.name}" agora é admin.`)
                              }
                            >
                              {u.role === 'admin' ? 'Tirar admin' : 'Tornar admin'}
                            </Botao>
                          )}
                          <Botao
                            variante="secundario"
                            className={u.is_active ? 'botao--pequeno botao--perigo' : 'botao--pequeno'}
                            carregando={ocupado === u.id}
                            disabled={ocupado !== null && ocupado !== u.id}
                            aria-label={u.is_active ? `Desativar ${u.name}` : `Reativar ${u.name}`}
                            onClick={() =>
                              u.is_active
                                ? mudar(u, { is_active: false }, `Desativar a conta de "${u.name}"?\n\nA pessoa sai de todos os aparelhos e não consegue mais entrar até ser reativada.`, `A conta de "${u.name}" foi desativada.`)
                                : mudar(u, { is_active: true }, `Reativar a conta de "${u.name}"?`, `A conta de "${u.name}" foi reativada.`)
                            }
                          >
                            {u.is_active ? 'Desativar' : 'Reativar'}
                          </Botao>
                        </div>
                      )}
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
