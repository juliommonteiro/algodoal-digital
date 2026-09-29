"""Dependências de autenticação e autorização para as rotas."""

from collections.abc import Callable
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.security import TokenInvalido, decodificar_token
from app.db.session import get_db
from app.models import User
from app.schemas.auth import Perfil
from app.services import auth

# auto_error=False: sem cabeçalho, nós mesmos respondemos 401 (o padrão do FastAPI dá 403).
_bearer = HTTPBearer(auto_error=False, description="Token de acesso (type=access)")


def _nao_autenticado(detalhe: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detalhe,
        headers={"WWW-Authenticate": "Bearer"},
    )


def usuario_atual(
    db: Annotated[Session, Depends(get_db)],
    credenciais: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> User:
    """Dono do token de acesso. 401 se ausente, expirado, malformado, com assinatura errada,
    do tipo renovação, de usuário inativo ou de sessão já revogada."""
    if credenciais is None:
        raise _nao_autenticado("Não autenticado.")
    try:
        claims = decodificar_token(credenciais.credentials, "access")
    except TokenInvalido as exc:
        raise _nao_autenticado("Token inválido ou expirado.") from exc
    usuario = auth.usuario_da_sessao(db, claims)
    if usuario is None:
        raise _nao_autenticado("Sessão encerrada. Entre de novo.")
    return usuario


UsuarioAtual = Annotated[User, Depends(usuario_atual)]


def requer_perfil(*perfis: Perfil) -> Callable[[User], User]:
    """Restringe a rota a alguns perfis. Uso (S6 em diante):

        @router.post("/places")
        def criar(admin: Annotated[User, Depends(requer_perfil("admin"))]): ...

    Sem token: 401 (de usuario_atual). Com token de outro perfil: 403. O perfil vem do banco,
    não da claim `role` do token — mudar o perfil de alguém vale na hora.
    """
    if not perfis:
        raise ValueError("requer_perfil precisa de pelo menos um perfil")

    def dependencia(usuario: UsuarioAtual) -> User:
        if usuario.role not in perfis:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Seu perfil não tem acesso a este recurso.",
            )
        return usuario

    return dependencia
