# Deploy na AWS (demonstração)

Servidor da apresentação de **25/11**, no ar por cerca de 2 semanas depois. Uma EC2 em
`us-east-1` roda o [compose.prod.yml](../compose.prod.yml) com três serviços:

- **caddy**: serve o PWA, encaminha `/api` e cuida do HTTPS.
- **api**: FastAPI.
- **db**: PostgreSQL 16.

A URL é fixa, `https://<IP-com-hifens>.sslip.io`, a partir de um Elastic IP, porque vai num QR
code impresso.

Custo aproximado em `us-east-1`, para cerca de 3 semanas: **US$ 15**. Isso soma o t3.small
(~US$ 0,021/h), 20 GB de gp3 (~US$ 1,60/mês) e o IPv4 público (US$ 0,005/h, também cobrado
pelo Elastic IP). Confira na [calculadora](https://calculator.aws/) se precisar do número exato.

> **Antes de imprimir o banner**, faça todos os passos e confirme que o HTTPS abre no celular.
> Se o Let's Encrypt recusar o sslip.io, a URL muda para nip.io (seção
> [Se o certificado não sair](#se-o-certificado-não-sair)), e o QR code impresso ficaria errado.

## 0. Alerta de custo (2 minutos, recomendado)

**Billing and Cost Management → Budgets → Create budget**:

1. Use a template → **Monthly cost budget**.
2. Budget name `algodoal-demo`, valor **20** (USD), seu e-mail.
3. **Create budget**.

Você recebe um e-mail se algo esquecido continuar cobrando.

## 1. Criar a instância

No console, confira no canto superior direito que a região é **N. Virginia (us-east-1)**.
Depois vá em **EC2 → Instances → Launch instances**.

| Campo | Valor |
|---|---|
| **Name and tags** | Name: `algodoal-demo`. Em **Add additional tags**: Key `projeto`, Value `algodoal-demo`, Resource types: **Instances** e **Volumes** |
| **Application and OS Images** | **Ubuntu** → **Ubuntu Server 24.04 LTS (HVM), SSD Volume Type**, Architecture **64-bit (x86)** |
| **Instance type** | **t3.small** |
| **Key pair** | **Create new key pair**: nome `algodoal-demo`, tipo **ED25519**, formato **.pem** → Create. O arquivo `algodoal-demo.pem` baixa uma vez só: guarde. |
| **Network settings** | Clique **Edit**. VPC e subnet: o padrão. **Auto-assign public IP: Enable**. Firewall: **Create security group**, nome `algodoal-demo-sg`, descrição `Algodoal demo: web publico, SSH so do meu IP` |
| Regras de entrada | 1) **ssh**, TCP 22, Source type **My IP**. 2) **Add security group rule**: **HTTP**, TCP 80, Source **Anywhere** (`0.0.0.0/0`). 3) **Add security group rule**: **HTTPS**, TCP 443, Source **Anywhere** (`0.0.0.0/0`) |
| **Configure storage** | **20** GiB, **gp3** |
| **Advanced details** | Nada a mudar. O *Credit specification* padrão do t3 (Unlimited) pode cobrar alguns centavos nos builds. |

Clique **Launch instance**. Em **Instances**, espere *Instance state* = **Running** e *Status
check* = **3/3 checks passed** (leva 1 a 2 minutos).

O security group é só deste projeto. Não reaproveite outro, nem use o `default`.

## 2. Elastic IP e o DOMAIN

**EC2 → Network & Security → Elastic IPs → Allocate Elastic IP address**:

1. Network border group `us-east-1`, **Amazon's pool of IPv4 addresses**.
2. Em **Tags → Add new tag**: `projeto` = `algodoal-demo`.
3. **Allocate**.

Com o IP novo selecionado, use **Actions → Associate Elastic IP address**:

1. Resource type **Instance**, Instance `algodoal-demo`, Private IP: o único da lista.
2. **Associate**.

Daqui em diante, o IP da instância é este Elastic IP. O IP público anterior deixa de valer.

Monte o **DOMAIN** trocando os pontos do IP por hífens e acrescentando `.sslip.io`:

```
Elastic IP 54.123.45.67  →  DOMAIN=54-123-45-67.sslip.io
```

Confira no PowerShell. A resposta tem de ser o seu Elastic IP:

```powershell
Resolve-DnsName 54-123-45-67.sslip.io
```

Nos exemplos abaixo, troque `54.123.45.67` pelo seu IP.

## 3. SSH a partir do Windows (PowerShell)

Guarde a chave em `~\.ssh` e deixe só você com acesso a ela. Sem isso, o OpenSSH do Windows
recusa a chave com *UNPROTECTED PRIVATE KEY FILE*:

```powershell
New-Item -ItemType Directory -Force $HOME\.ssh | Out-Null
Move-Item $HOME\Downloads\algodoal-demo.pem $HOME\.ssh\
icacls $HOME\.ssh\algodoal-demo.pem /inheritance:r /grant:r "$($env:USERNAME):R"
```

Mande o script de preparação e entre. Rode da pasta do repositório no seu computador:

```powershell
cd D:\dev\projetos\algodoal-digital
scp -i $HOME\.ssh\algodoal-demo.pem .\scripts\server-setup.sh ubuntu@54.123.45.67:~/
ssh -i $HOME\.ssh\algodoal-demo.pem ubuntu@54.123.45.67
```

Na primeira conexão, responda `yes` para guardar a identidade do servidor.

## 4. Preparar o servidor (uma vez)

No servidor (prompt `ubuntu@ip-...`):

```bash
bash server-setup.sh
```

O script instala o Docker e o plugin compose. Também cria 2 GB de swap, liga o ufw (22, 80 e
443), acerta o fuso para America/Belem e clona o repositório em `~/algodoal-digital`.

- **Branch:** o clone usa a `main`. Enquanto o PR do deploy não tiver merge, use
  `BRANCH=chore/deploy-aws bash server-setup.sh`.
- **Repositório privado:** o `git clone` pede usuário e senha. A senha é um token do GitHub:
  1. **Settings → Developer settings → Personal access tokens → Fine-grained tokens →
     Generate new token**.
  2. Repository access: **Only select repositories** → `algodoal-digital`.
  3. Permissions: **Contents: Read-only**. Expiration: **30 days**.
  4. Para o `git pull` do deploy não pedir o token toda vez, rode
     `git -C ~/algodoal-digital config credential.helper store` (grava em `~/.git-credentials`).
     Revogue o token no desligamento.

No fim, **saia e entre de novo** para o usuário `ubuntu` usar o Docker sem sudo:

```bash
exit
```

```powershell
ssh -i $HOME\.ssh\algodoal-demo.pem ubuntu@54.123.45.67
```

## 5. Criar o .env.prod

No servidor, troque o DOMAIN pelo seu:

```bash
cd ~/algodoal-digital
cp .env.prod.example .env.prod
sed -i "s|^DOMAIN=.*|DOMAIN=54-123-45-67.sslip.io|" .env.prod
sed -i "s|^SECRET_KEY=.*|SECRET_KEY=$(openssl rand -hex 32)|" .env.prod
sed -i "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$(openssl rand -hex 24)|" .env.prod
sed -i "s|^ADMIN_PASSWORD=.*|ADMIN_PASSWORD=$(openssl rand -base64 18)|" .env.prod
chmod 600 .env.prod
grep -E '^(DOMAIN|ADMIN_EMAIL|ADMIN_PASSWORD)=' .env.prod
```

Anote o `ADMIN_EMAIL` e o `ADMIN_PASSWORD` num gerenciador de senhas. Esse é o login do admin,
e ele não está no [docs/demo.md](demo.md). O `.env.prod` nunca vai para o git. Cada variável
está explicada no [.env.prod.example](../.env.prod.example).

## 6. Subir

```bash
./scripts/deploy.sh    # git pull, build, up, espera ficar saudável, testa https://DOMAIN
./scripts/demo.sh      # catálogo inicial e contas da apresentação
```

O primeiro build leva de 5 a 10 minutos: compila o frontend e baixa as imagens. No fim, o
`deploy.sh` mostra `No ar: https://...`.

Abra a URL no celular, pelo 4G, e confira:

- o cadeado do HTTPS;
- o mapa abrindo;
- o login com `turista.demo@example.com` / `algodoal-demo`.

Só então gere o QR code.

**Atualizar depois:** faça merge na `main` e rode `./scripts/deploy.sh` no servidor. Os dados
(volumes `pgdata`, `fotos`, `caddy_data`) sobrevivem a rebuild e a `down`. Só um `down -v`
apaga os volumes: não use.

## Se o certificado não sair

O Caddy pede o certificado ao Let's Encrypt sozinho, na primeira subida, pelas portas 80 e 443.
Para ver o que aconteceu:

```bash
docker compose -f compose.prod.yml --env-file .env.prod logs caddy | grep -iE 'error|acme|certificate'
```

- **Recusa do sslip.io** (`rateLimited`, `too many certificates`, `rejectedIdentifier`):
  - O sslip.io é um domínio compartilhado por muita gente, e o Let's Encrypt pode recusá-lo.
  - A alternativa é o **nip.io**, que funciona do mesmo jeito. Troque **só o DOMAIN** e suba de
    novo:

    ```bash
    sed -i "s|^DOMAIN=.*|DOMAIN=54-123-45-67.nip.io|" .env.prod
    SEM_PULL=1 ./scripts/deploy.sh
    ```

  - Confira antes com `Resolve-DnsName 54-123-45-67.nip.io`. O QR code passa a ser o da URL
    nip.io.
- **Timeout ou connection refused:** o security group não está com 80 e 443 abertos para
  `0.0.0.0/0`, ou o DOMAIN não aponta para o Elastic IP.

## Comandos do dia a dia

No servidor, em `~/algodoal-digital`. O `dc` é só um atalho para a sessão:

```bash
alias dc='docker compose -f compose.prod.yml --env-file .env.prod'
dc ps                        # estado e health de cada serviço
dc logs -f --tail 100 api    # log da API (JSON, com o IP real do cliente)
dc restart api               # reinicia só a API
docker stats --no-stream     # memória de cada container
free -h && df -h /           # memória/swap e disco da máquina
./scripts/backup-db.sh       # cópia do banco em backups/ (mostra o scp para baixar)
```

### Backup das fotos

As fotos ficam no volume `algodoal-prod_fotos`, fora do backup do banco:

```bash
docker run --rm -v algodoal-prod_fotos:/fotos:ro -v "$PWD/backups":/backup alpine \
  tar czf "/backup/fotos-$(date +%Y%m%d).tar.gz" -C /fotos .
```

Baixe no PowerShell:

```powershell
scp -i $HOME\.ssh\algodoal-demo.pem "ubuntu@54.123.45.67:~/algodoal-digital/backups/*" .
```

## Checklist da apresentação (25/11)

**Na véspera**

- [ ] `dc ps`: os três serviços **healthy**; `free -h` com swap pouco usado; `df -h /` com mais de 3 GB livres.
- [ ] `./scripts/backup-db.sh` e baixe o arquivo para o Windows.
- [ ] `./scripts/demo.sh --reset` (digite `RESETAR`). Contas e pedidos do ensaio somem e o catálogo fica.
- [ ] Pelo 4G, no celular: entre com cada conta do [docs/demo.md](demo.md) e com o admin.
- [ ] Faça o roteiro da carroça com dois celulares: turista pede, carroceiro aceita. Depois rode o `--reset` de novo.
- [ ] Escaneie o **QR code impresso** com um iPhone (câmera) e um Android.
- [ ] Instale o app no celular da apresentação (Adicionar à tela inicial) e abra uma vez com rede. Com isso, o mapa funciona offline se a internet do evento cair.
- [ ] Não faça deploy no dia da apresentação.

**No dia**

- [ ] 1 hora antes: abra `https://DOMAIN/api/v1/health/db` (tem de responder `{"status":"ok","database":"up"}`).
- [ ] EC2 → Instances: *Status check* **3/3 checks passed**.
- [ ] SSH à mão se precisar. A regra 22 só aceita o IP de onde você a criou. Do Wi-Fi do evento, edite a regra em **Security groups → algodoal-demo-sg → Edit inbound rules → ssh → Source: My IP**.
- [ ] Plano B: capturas de tela ou vídeo do app, caso a rede do local falhe de vez.

## Checklist de desligamento (cerca de 2 semanas depois)

1. **Backup final:** `./scripts/backup-db.sh` e o backup das fotos (seção acima). Baixe os dois
   para o Windows com `scp`.
2. **Terminar a instância:** EC2 → Instances → `algodoal-demo` → **Instance state → Terminate
   (delete) instance**. Espere o estado **Terminated**.
3. **Liberar o Elastic IP:** Elastic IPs → selecione → **Actions → Release Elastic IP addresses**.
   Um Elastic IP sem instância continua cobrando US$ 0,005/h até ser liberado.
4. **Volume:** EC2 → Elastic Block Store → **Volumes**. O de 20 GiB some junto com a instância
   (*Delete on termination* é o padrão do disco raiz). Se sobrar algum `available` com a tag
   `projeto=algodoal-demo`, **Actions → Delete volume**.
5. **Snapshots:** EC2 → **Snapshots** (Owned by me). Apague os que tiver criado.
6. **Limpeza:**
   - Security groups → `algodoal-demo-sg` → **Delete** (depois que a instância terminou).
   - Key pairs → `algodoal-demo` → **Delete**. Apague também o `.pem` do Windows.
   - No GitHub, revogue o token de leitura, se criou um.
7. **Conferir que nada ficou cobrando:**
   - **Resource Groups & Tag Editor → Tag Editor**: Regions **All regions**, Resource types
     **All supported resource types**, Tag key `projeto`, value `algodoal-demo` → **Search
     resources**. Não pode sobrar nada.
   - **Billing and Cost Management → Bills**, no mês atual: *Elastic Compute Cloud* e *Virtual
     Private Cloud* (IPv4 público) param de crescer em 1 ou 2 dias.
   - No **Cost Explorer**, o custo diário vai a zero.
   - Mantenha o budget do passo 0 até a fatura do mês fechar.
