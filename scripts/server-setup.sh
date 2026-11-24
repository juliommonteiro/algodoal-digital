#!/usr/bin/env bash
# Prepara a EC2 (Ubuntu 24.04) para o compose.prod.yml. Rode UMA vez, como o usuário ubuntu:
#
#   bash server-setup.sh
#
# Instala o Docker e o plugin compose, cria 2 GB de swap, liga o firewall (22, 80 e 443) e clona
# o repositório em ~/algodoal-digital. Pode rodar de novo: o que já está feito é pulado.
#
# Variáveis opcionais:
#   REPO_URL   (padrão: https://github.com/juliommonteiro/algodoal-digital.git)
#   BRANCH     (padrão: main)
#   DESTINO    (padrão: ~/algodoal-digital)
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/juliommonteiro/algodoal-digital.git}"
BRANCH="${BRANCH:-main}"
DESTINO="${DESTINO:-$HOME/algodoal-digital}"
SWAP=/swapfile

passo() { printf '\n\033[1;32m==> %s\033[0m\n' "$*"; }

if [[ $EUID -eq 0 ]]; then
  echo "Rode como o usuário ubuntu (sem sudo): o script pede sudo quando precisa." >&2
  exit 1
fi

passo "Pacotes do sistema"
sudo apt-get update -y
sudo apt-get install -y ca-certificates curl git ufw

passo "Docker e plugin compose (repositório oficial da Docker)"
if ! command -v docker >/dev/null 2>&1; then
  sudo install -m 0755 -d /etc/apt/keyrings
  sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  sudo chmod a+r /etc/apt/keyrings/docker.asc
  codinome="$(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}")"
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${codinome} stable" |
    sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
  sudo apt-get update -y
  sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
else
  echo "Docker já instalado: $(docker --version)"
fi
sudo systemctl enable --now docker
# Docker sem sudo (vale a partir do próximo login por SSH).
sudo usermod -aG docker "$USER"

passo "Swap de 2 GB (o build do frontend não cabe só nos 2 GB de RAM)"
if ! sudo swapon --show=NAME --noheadings | grep -qx "$SWAP"; then
  sudo fallocate -l 2G "$SWAP"
  sudo chmod 600 "$SWAP"
  sudo mkswap "$SWAP"
  sudo swapon "$SWAP"
  grep -q "^$SWAP " /etc/fstab || echo "$SWAP none swap sw 0 0" | sudo tee -a /etc/fstab >/dev/null
else
  echo "Swap já ativo."
fi
# Usa o swap só em último caso: ele é disco, e lento.
echo "vm.swappiness=10" | sudo tee /etc/sysctl.d/99-algodoal.conf >/dev/null
sudo sysctl -q --system

passo "Firewall (ufw): SSH, HTTP e HTTPS"
# O 22 entra antes do enable, senão a sessão SSH atual cai. Quem limita o 22 ao seu IP é o
# security group da AWS; o ufw é a segunda barreira. Atenção: portas publicadas pelo Docker
# passam por fora do ufw. Por isso só o Caddy publica portas (80 e 443) no compose.prod.yml.
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
sudo ufw status verbose

passo "Fuso horário (logs e nomes de backup no horário de Belém)"
sudo timedatectl set-timezone America/Belem

passo "Repositório em $DESTINO"
if [[ -d "$DESTINO/.git" ]]; then
  echo "Já clonado. Atualizações: ./scripts/deploy.sh"
else
  # Repositório privado: o git pede usuário e senha. A senha é um token do GitHub (fine-grained,
  # só leitura de Contents deste repositório). Veja docs/deploy-aws.md.
  git clone --branch "$BRANCH" "$REPO_URL" "$DESTINO"
fi

passo "Pronto"
cat <<EOF
Próximos passos (docs/deploy-aws.md):
  1. Saia (exit) e entre de novo por SSH, para usar o docker sem sudo.
  2. cd $DESTINO && cp .env.prod.example .env.prod && nano .env.prod
  3. ./scripts/deploy.sh
  4. ./scripts/demo.sh
EOF
