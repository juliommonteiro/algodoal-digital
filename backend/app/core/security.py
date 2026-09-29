"""Senhas (Argon2) e tokens (JWT HS256).

Acesso e renovação têm as mesmas claims — sub, role, exp, iat, jti, type —, e o `type` é o
que impede usar um token de renovação como se fosse de acesso. O de acesso leva também `sid`:
o jti do token de renovação emitido junto. É por ele que um access token deixa de valer quando
a sessão é revogada (logout, rotação, detecção de reuso), sem esperar os 15 minutos do `exp`.
"""

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from functools import lru_cache
from typing import Any, Literal

import jwt
from pwdlib import PasswordHash

from app.core.config import get_settings

TipoToken = Literal["access", "refresh"]

# Argon2id com os parâmetros recomendados pelo pwdlib (OWASP).
_hasher = PasswordHash.recommended()


class TokenInvalido(Exception):
    """Token ausente, malformado, expirado, com assinatura errada ou de outro tipo."""


# ---------------------------------------------------------------------------- senhas


def gerar_hash(senha: str) -> str:
    return _hasher.hash(senha)


def verificar_senha(senha: str, hash_salvo: str) -> tuple[bool, str | None]:
    """(confere?, novo_hash). O novo hash vem quando os parâmetros do Argon2 mudaram desde que
    o hash foi gerado: quem chama deve gravá-lo, para a senha migrar sem ninguém perceber."""
    return _hasher.verify_and_update(senha, hash_salvo)


@lru_cache
def _hash_falso() -> str:
    return _hasher.hash("senha-que-nenhum-usuario-tem")


def gastar_tempo_de_verificacao(senha: str) -> None:
    """Verifica contra um hash qualquer quando o e-mail não existe, para o login com e-mail
    inexistente demorar o mesmo que o com senha errada — senão o tempo de resposta entregaria
    quais e-mails estão cadastrados, mesmo com a mesma mensagem de erro."""
    _hasher.verify(senha, _hash_falso())


# ---------------------------------------------------------------------------- tokens


@dataclass(frozen=True)
class TokenEmitido:
    token: str
    jti: str
    expira_em: datetime


def criar_token(
    *,
    user_id: uuid.UUID,
    role: str,
    tipo: TipoToken,
    sid: str | None = None,
    agora: datetime | None = None,
) -> TokenEmitido:
    settings = get_settings()
    agora = agora or datetime.now(UTC)
    duracao = (
        timedelta(minutes=settings.access_token_minutos)
        if tipo == "access"
        else timedelta(days=settings.refresh_token_dias)
    )
    jti = uuid.uuid4().hex
    expira_em = agora + duracao
    claims: dict[str, Any] = {
        "sub": str(user_id),  # RFC 7519: sub é string
        "role": role,
        "iat": int(agora.timestamp()),
        "exp": int(expira_em.timestamp()),
        "jti": jti,
        "type": tipo,
    }
    if sid is not None:
        claims["sid"] = sid
    token = jwt.encode(claims, settings.secret_key, algorithm=settings.jwt_algoritmo)
    return TokenEmitido(token=token, jti=jti, expira_em=expira_em)


def decodificar_token(token: str, tipo_esperado: TipoToken) -> dict[str, Any]:
    """Valida assinatura, expiração, presença das claims e o `type`. Qualquer falha vira
    TokenInvalido — quem chama não precisa (nem deve) distinguir o motivo para o cliente."""
    settings = get_settings()
    try:
        claims = jwt.decode(
            token,
            settings.secret_key,
            algorithms=[settings.jwt_algoritmo],  # lista fixa: nunca aceitar o "alg" do token
            options={"require": ["sub", "role", "exp", "iat", "jti", "type"]},
        )
    except jwt.PyJWTError as exc:
        raise TokenInvalido(str(exc)) from exc
    # O tipo primeiro: é a defesa contra usar a renovação (30 dias) como acesso.
    if claims["type"] != tipo_esperado:
        raise TokenInvalido(f"token do tipo {claims['type']!r}, esperado {tipo_esperado!r}")
    if tipo_esperado == "access" and not isinstance(claims.get("sid"), str):
        raise TokenInvalido("token de acesso sem sid")
    try:
        uuid.UUID(claims["sub"])
    except (ValueError, TypeError, AttributeError) as exc:
        raise TokenInvalido("sub não é um UUID") from exc
    return claims
