# Contas da apresentação

Contas prontas no servidor de demonstração (`https://<IP-com-hifens>.sslip.io`), criadas por
`./scripts/demo.sh` ([backend/scripts/demo.py](../backend/scripts/demo.py)).

> **Senha só de demonstração.** Ela está publicada aqui, e o link vai num QR code impresso.
> Qualquer pessoa pode entrar nestas contas. Não guarde nada de verdade nelas e rode o reset
> antes da apresentação.

Senha de todas, menos a do admin: **`algodoal-demo`**

| Perfil | E-mail | O que mostrar |
|---|---|---|
| Turista | `turista.demo@example.com` | Mapa, diretório, passaporte, pedido de carroça em `/carroca` |
| Carroceiro | `bento.demo@example.com` | `/carroceiro`: aceitar ou recusar o pedido (Carroça do Bento, 4 lugares) |
| Carroceira | `rosa.demo@example.com` | `/carroceiro`: segundo carroceiro disponível (Carroça da Rosa, 6 lugares) |
| Parceiro | `parceiro.demo@example.com` | `/parceiro`: edita o próprio estabelecimento (Pousada Maré Mansa) e as fotos |
| Admin | o `ADMIN_EMAIL` do `.env.prod` (padrão `admin.demo@example.com`) | `/admin`: catálogo, contas, indicadores |

A senha do **admin não fica aqui**. Ela é o `ADMIN_PASSWORD` do `.env.prod` do servidor. Com ela
publicada, qualquer pessoa que escaneasse o banner poderia mudar o catálogo no meio da
apresentação.

As duas carroças começam **disponíveis e aprovadas**. Se a Pousada Maré Mansa tiver sido renomeada
ou já tiver dono, o parceiro fica com o primeiro estabelecimento parceiro sem dono. O comando
mostra qual foi.

## Roteiro sugerido do pedido de carroça

1. No celular A, entre como `turista.demo@example.com`, abra **Carroça** e peça uma corrida.
2. No celular B, entre como `bento.demo@example.com`. O pedido aparece em `/carroceiro`: aceite.
3. No celular A, o pedido muda para aceito, com o contato do carroceiro.

## Preparar e resetar

No servidor, dentro de `~/algodoal-digital`:

```bash
./scripts/demo.sh            # cria ou acerta o que faltar; não apaga nada
./scripts/backup-db.sh       # antes do reset, por garantia
./scripts/demo.sh --reset    # pede para digitar RESETAR
```

O que cada um faz:

- **`./scripts/demo.sh`** carrega as categorias e o catálogo inicial se o banco não tiver nenhum
  local. Também cria as contas acima, ou devolve a elas a senha, o perfil e as carroças
  disponíveis. Pode rodar quantas vezes quiser.
- **`./scripts/demo.sh --reset`** apaga **todas** as contas, inclusive quem se cadastrou no
  ensaio, e com elas as sessões, os pedidos de carroça e os perfis de carroceiro. Os
  estabelecimentos ficam sem dono. Depois recria só as contas da demonstração.
- **Nenhum dos dois apaga o catálogo** (locais, estabelecimentos, fotos, categorias). Ele é da
  equipe e corrigido à mão pelo painel. Além disso, o celular de quem já abriu o app sincroniza só
  o que mudou: local apagado de verdade ficaria para sempre lá. Para mudar o catálogo, use o
  `/admin`.
