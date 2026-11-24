# syntax=docker/dockerfile:1
# Imagem do Caddy com o PWA já compilado (compose.prod.yml). Contexto: a raiz do repositório.
# O que entra no contexto está em Dockerfile.dockerignore, ao lado deste arquivo.

FROM node:22-alpine AS build
WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
# API real e na mesma origem: o Caddy encaminha /api. Sem VITE_USAR_MOCK=false o build sairia
# com o mock (src/lib/cliente.ts), e o frontend/.env não vem para cá.
ENV VITE_USAR_MOCK=false \
    VITE_API_URL=
RUN npm run build

FROM caddy:2-alpine
COPY deploy/caddy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /frontend/dist /srv
