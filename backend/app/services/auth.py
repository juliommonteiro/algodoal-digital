"""Cadastro, login, renovação com rotação, logout e a sessão por trás do token de acesso.

Sessão = um token de renovação ativo na tabela refresh_tokens. O token de acesso aponta para
ela pela claim `sid`; revogar a sessão derruba também o acesso, sem esperar o `exp`.

Token de renovação revogado que volta ao /refresh, conforme o motivo:
- rotation, há menos de `refresh_janela_de_graca_segundos`: corrida entre abas ou contextos
  do PWA, não ataque. Devolve o par da sessão que o substituiu, sem revogar nem emitir nada.
- rotation, fora da janela: vazou. Todas as sessões do usuário caem.
- logout ou reuse: 401 e só. Logout reapresentado por outra aba não é vazamento.
"""

import logging
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import exists, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import (
    TokenInvalido,
    decodificar_token,
    gastar_tempo_de_verificacao,
    gerar_hash,
    montar_par,
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


# Limite de segurança ao seguir replaced_by_jti (uma cadeia real tem poucos elos na janela).
_MAX_ELOS_NA_CADEIA = 50


def _par_da_sessao(user: User, sessao: RefreshToken) -> ParDeTokens:
    """Remonta o par de uma sessão registrada — idêntico ao que foi entregue na emissão."""
    par = montar_par(
        user_id=user.id,
        role=user.role,
        jti_renovacao=sessao.jti,
        emitido_em=sessao.created_at,
        renovacao_expira_em=sessao.expires_at,
    )
    return ParDeTokens(access_token=par.access_token, refresh_token=par.refresh_token, user=user)


def _abrir_sessao(db: Session, user: User) -> tuple[ParDeTokens, RefreshToken]:
    """Registra uma sessão nova e devolve o par dela. Quem chama faz o commit."""
    # Segundos exatos: created_at é o `iat` dos tokens, e precisa sair igual ao remontar.
    emitida_em = _agora().replace(microsecond=0)
    sessao = RefreshToken(
        jti=uuid.uuid4().hex,
        user_id=user.id,
        created_at=emitida_em,
        expires_at=emitida_em + timedelta(days=get_settings().refresh_token_dias),
    )
    db.add(sessao)
    return _par_da_sessao(user, sessao), sessao


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
    par, _ = _abrir_sessao(db, user)
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
    par, _ = _abrir_sessao(db, user)
    db.commit()
    return par


def revogar_todas_as_sessoes(db: Session, user_id: uuid.UUID) -> int:
    """Revoga toda renovação ativa do usuário (motivo `reuse`). Devolve quantas. Quem chama
    faz o commit."""
    resultado = db.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user_id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=_agora(), revoked_reason="reuse")
    )
    return resultado.rowcount


def _claims_de_renovacao(token: str) -> dict[str, Any]:
    try:
        return decodificar_token(token, "refresh")
    except TokenInvalido as exc:
        raise SessaoInvalida from exc


def renovar(db: Session, *, refresh_token: str) -> ParDeTokens:
    """Rotação: revoga o token apresentado (motivo `rotation`), abre uma sessão nova e anota
    nele quem o substituiu. Token já revogado segue as regras do topo do módulo."""
    claims = _claims_de_renovacao(refresh_token)
    # FOR UPDATE: duas renovações simultâneas com o mesmo token não passam as duas — a segunda
    # espera a primeira gravar e cai na janela de graça, recebendo o mesmo par.
    registro = db.scalar(
        select(RefreshToken).where(RefreshToken.jti == claims["jti"]).with_for_update()
    )
    if registro is None or str(registro.user_id) != claims["sub"]:
        raise SessaoInvalida

    if registro.revoked_at is not None:
        return _reapresentado(db, registro)

    user = db.get(User, registro.user_id)
    if user is None or not user.is_active or registro.expires_at <= _agora():
        raise SessaoInvalida

    par, sucessor = _abrir_sessao(db, user)
    registro.revoked_at = _agora()
    registro.revoked_reason = "rotation"
    registro.replaced_by_jti = sucessor.jti
    db.commit()
    return par


def _reapresentado(db: Session, registro: RefreshToken) -> ParDeTokens:
    """Token de renovação já revogado de volta ao /refresh. Devolve o par (janela de graça) ou
    levanta SessaoInvalida / ReusoDetectado."""
    if registro.revoked_reason != "rotation":
        # logout (outra aba reapresentando) ou reuse (a sessão já caiu): 401, nada mais.
        raise SessaoInvalida

    janela = timedelta(seconds=get_settings().refresh_janela_de_graca_segundos)
    if _agora() - registro.revoked_at < janela:
        user = db.get(User, registro.user_id)
        sucessor = _sucessor_ativo(db, registro)
        if user is None or not user.is_active or sucessor is None:
            raise SessaoInvalida
        logger.info(
            "Renovação repetida na janela de graça: user_id=%s jti=%s -> par de %s.",
            registro.user_id,
            registro.jti,
            sucessor.jti,
        )
        return _par_da_sessao(user, sucessor)

    derrubadas = revogar_todas_as_sessoes(db, registro.user_id)
    db.commit()  # a revogação vale mesmo com a resposta sendo 401
    logger.warning(
        "Reuso de token de renovação revogado: user_id=%s jti=%s (trocado há %s). "
        "%d sessão(ões) ativa(s) revogada(s).",
        registro.user_id,
        registro.jti,
        _agora() - registro.revoked_at,
        derrubadas,
    )
    raise ReusoDetectado


def _sucessor_ativo(db: Session, registro: RefreshToken) -> RefreshToken | None:
    """Segue replaced_by_jti até a sessão ativa. A -> B -> C em sequência rápida: quem
    reapresenta A recebe o par de C (o de B já não vale). Se a cadeia terminar em logout,
    reuso ou expiração, não há par a devolver."""
    atual = registro
    for _ in range(_MAX_ELOS_NA_CADEIA):
        if atual.replaced_by_jti is None:
            return None
        atual = db.scalar(select(RefreshToken).where(RefreshToken.jti == atual.replaced_by_jti))
        if atual is None:
            return None
        if atual.revoked_at is None:
            return atual if atual.expires_at > _agora() else None
        if atual.revoked_reason != "rotation":
            return None
    return None


def encerrar_sessao(db: Session, *, refresh_token: str) -> None:
    """Logout: revoga o token apresentado (motivo `logout`). Idempotente — já revogado não é
    erro nem reuso."""
    claims = _claims_de_renovacao(refresh_token)
    registro = db.scalar(select(RefreshToken).where(RefreshToken.jti == claims["jti"]))
    if (
        registro is not None
        and registro.revoked_at is None
        and str(registro.user_id) == claims["sub"]
    ):
        registro.revoked_at = _agora()
        registro.revoked_reason = "logout"
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
