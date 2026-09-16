# Como contribuir

## Fluxo de trabalho

`main` é sempre estável e protegida: ninguém faz push direto.

1. Pegue uma issue no board e mova para **Em andamento**.
2. Crie a branch a partir da `main`: `tipo/numero-descricao-curta`
   - `feat/14-endpoints-locais`
   - `fix/31-mapa-nao-carrega-offline`
3. Commits pequenos, seguindo o padrão abaixo.
4. Abra o PR com `Fecha #14` na descrição. O CI precisa passar.
5. Pelo menos 1 revisão de outra pessoa da equipe.
6. Merge com **squash** — o título do PR vira o commit na `main`, então ele também segue o padrão.

## Padrão de commits (Conventional Commits)

```
<tipo>(<escopo>): <descrição no imperativo, minúscula, sem ponto>
```

| Tipo | Quando usar |
|---|---|
| `feat` | nova funcionalidade |
| `fix` | correção de bug |
| `docs` | só documentação |
| `refactor` | muda código sem mudar comportamento |
| `test` | adiciona ou corrige testes |
| `chore` | dependências, configs, tarefas de manutenção |
| `ci` | pipeline |

Escopos: `api`, `web`, `db`, `offline`, `infra`, `docs`.

Exemplos:

```
feat(api): adiciona endpoint de listagem de locais
fix(web): corrige filtro de categorias no mapa
chore(db): cria migração de places e categories
ci: roda migrações no job do backend
```

## Board

Colunas: **Backlog → A fazer (semana) → Em andamento → Em revisão → Concluído**.
Na reunião semanal, o que entra em "A fazer" é o que está no cronograma daquela semana.

## Migrações

Toda mudança de model gera migração versionada (`make revision m="..."`).
Nunca edite uma migração que já foi para a `main` — crie outra.
