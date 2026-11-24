FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app


# Produção (compose.prod.yml, target: prod): sem as dependências de dev, sem reload, sem root.
# Ao subir, aplica as migrações e então sobe o uvicorn.
FROM base AS prod

COPY pyproject.toml ./
RUN pip install --upgrade pip && pip install .
COPY alembic.ini ./
COPY alembic ./alembic
COPY app ./app
COPY scripts ./scripts

# A pasta das fotos nasce do usuário da API: o volume nomeado montado aqui herda o dono.
RUN useradd --system --uid 10001 --home-dir /app algodoal \
    && mkdir -p /app/media \
    && chown algodoal /app/media
USER algodoal

EXPOSE 8000
# 2 workers: cabem nos 2 GB do t3.small (cada login gasta ~64 MB no Argon2) e um segura o
# outro se travar. --no-proxy-headers: quem lê o X-Forwarded-For é o app, só do Caddy
# (TRUSTED_PROXIES). --no-access-log: o log JSON do app já registra cada requisição, com IP.
CMD ["sh", "-c", "alembic upgrade head && exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers ${WEB_CONCURRENCY:-2} --no-proxy-headers --no-access-log --no-server-header"]


# Desenvolvimento (docker-compose.yml): o último estágio é o padrão do `docker compose build`,
# então o fluxo local continua igual. O código vem do bind mount e o compose roda com --reload.
FROM base AS dev

COPY pyproject.toml ./
RUN pip install --upgrade pip && pip install ".[dev]"
COPY . .

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
