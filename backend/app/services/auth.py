"""Cadastro, login, renovação com rotação, logout e a sessão por trás do token de acesso.

Sessão = um token de renovação ativo na tabela refresh_tokens. O token de acesso aponta para
ela pela claim `sid`; revogar a sessão derruba também o acesso, sem esperar o `exp`.
"""

import logging
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import exists, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import (
    TokenInvalido,
    criar_token,
    decodificar_token,
    gastar_tempo_de_verificacao,
    gerar_hash,
    verificar_senha,
)
from app.models import RefreshToken, User

logger = logging.getLogger(__name__)


class EmailJaCadastrado(Exception):
    pass


class CredenciaisInvalidas(Exception):
    """E-mail inexistente, senha errada, usuário sem senha ou inativo: tudo igual para fora."""


class SessaoInvalida(Exception):
    """Token de renovação inválido, expirado, desconhecido ou revogado."""


class ReusoDetectado(SessaoInvalida):
    """Um token de renovação já revogado voltou: ele vazou. Todas as sessões caíram."""


@dataclass(frozen=True)
class ParDeTokens:
    access_token: str
    refresh_token: str
    user: User


def _normalizar_email(email: str) -> str:
    return email.strip().lower()


def _agora() -> datetime:
    return datetime.now(UTC)


def _abrir_sessao(db: Session, user: User) -> ParDeTokens:
    """Emite renovação + acesso e registra a renovação. Quem chama faz o commit."""
    renovacao = criar_token(user_id=user.id, role=user.role, tipo="refresh")
    db.add(RefreshToken(jti=renovacao.jti, user_id=user.id, expires_at=renovacao.expira_em))
    acesso = criar_token(user_id=user.id, role=user.role, tipo="access", sid=renovacao.jti)
    return ParDeTokens(access_token=acesso.token, refresh_token=renovacao.token, user=user)


def registrar(db: Session, *, nome: str, email: str, senha: str) -> ParDeTokens:
    """Cria um turista e já devolve a sessão aberta."""
    email = _normalizar_email(email)
    if db.scalar(select(exists().where(User.email == email))):
        raise EmailJaCadastrado
    user = User(name=nome, email=email, password_hash=gerar_hash(senha), role="tourist")
    db.add(user)
    try:
        db.flush()
    except IntegrityError as exc:  # dois cadastros simultâneos com o mesmo e-mail
        db.rollback()
        raise EmailJaCadastrado from exc
    par = _abrir_sessao(db, user)
    db.commit()
    return par


def autenticar(db: Session, *, email: str, senha: str) -> ParDeTokens:
    user = db.scalar(select(User).where(User.email == _normalizar_email(email)))
    if user is None or user.password_hash is None:
        gastar_tempo_de_verificacao(senha)
        raise CredenciaisInvalidas
    confere, hash_atualizado = verificar_senha(senha, user.password_hash)
    if not confere or not user.is_active:
        raise CredenciaisInvalidas
    if hash_atualizado:
        user.password_hash = hash_atualizado
    par = _abrir_sessao(db, user)
    db.commit()
    return par


def revogar_todas_as_sessoes(db: Session, user_id: uuid.UUID) -> int:
    """Revoga toda renovação ativa do usuário. Devolve quantas. Quem chama faz o commit."""
    resultado = db.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user_id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=_agora())
    )
    return resultado.rowcount


def _claims_de_renovacao(token: str) -> dict[str, Any]:
    try:
        return decodificar_token(token, "refresh")
    except TokenInvalido as exc:
        raise SessaoInvalida from exc


def renovar(db: Session, *, refresh_token: str) -> ParDeTokens:
    """Rotação: revoga o token apresentado e abre uma sessão nova.

    Token já revogado = vazou (quem tem o token legítimo já o trocou por outro). Aí todas as
    sessões do usuário caem — inclusive a do dono, que precisa entrar de novo — e o evento
    vai para o log.
    """
    claims = _claims_de_renovacao(refresh_token)
    # FOR UPDATE: duas renovações simultâneas com o mesmo token não passam as duas.
    registro = db.scalar(
        select(RefreshToken).where(RefreshToken.jti == claims["jti"]).with_for_update()
    )
    if registro is None or str(registro.user_id) != claims["sub"]:
        raise SessaoInvalida

    if registro.revoked_at is not None:
        derrubadas = revogar_todas_as_sessoes(db, registro.user_id)
        db.commit()  # a revogação vale mesmo com a resposta sendo 401
        logger.warning(
            "Reuso de token de renovação revogado: user_id=%s jti=%s. "
            "%d sessão(ões) ativa(s) revogada(s).",
            registro.user_id,
            registro.jti,
            derrubadas,
        )
        raise ReusoDetectado

    user = db.get(User, registro.user_id)
    if user is None or not user.is_active or registro.expires_at <= _agora():
        raise SessaoInvalida

    registro.revoked_at = _agora()
    par = _abrir_sessao(db, user)
    db.commit()
    return par


def encerrar_sessao(db: Session, *, refresh_token: str) -> None:
    """Logout: revoga o token apresentado. Idempotente — já revogado não é erro nem reuso."""
    claims = _claims_de_renovacao(refresh_token)
    registro = db.scalar(select(RefreshToken).where(RefreshToken.jti == claims["jti"]))
    if (
        registro is not None
        and registro.revoked_at is None
        and str(registro.user_id) == claims["sub"]
    ):
        registro.revoked_at = _agora()
        db.commit()


def usuario_da_sessao(db: Session, claims: dict[str, Any]) -> User | None:
    """Dono de um token de acesso já decodificado, se ativo e com a sessão (`sid`) de pé.
    Uma consulta só."""
    sessao_ativa = exists().where(
        RefreshToken.jti == claims["sid"],
        RefreshToken.user_id == User.id,
        RefreshToken.revoked_at.is_(None),
        RefreshToken.expires_at > _agora(),
    )
    return db.scalar(
        select(User).where(
            User.id == uuid.UUID(claims["sub"]), User.is_active.is_(True), sessao_ativa
        )
    )
