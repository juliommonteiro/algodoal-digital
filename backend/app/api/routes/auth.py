from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.api.deps import UsuarioAtual
from app.core.limites import LIMITE_LOGIN, LIMITE_REGISTRO, limiter
from app.db.session import get_db
from app.schemas.auth import LoginIn, RefreshIn, RegistroIn, RespostaLogin, UsuarioRead
from app.services import auth

router = APIRouter(prefix="/auth", tags=["autenticação"])

# Uma mensagem só para e-mail inexistente e senha errada: diferenciar entregaria a lista de
# e-mails cadastrados a quem quisesse testar.
CREDENCIAIS_INVALIDAS = "E-mail ou senha incorretos."
SESSAO_INVALIDA = "Sessão expirada. Entre de novo."

_401 = {status.HTTP_401_UNAUTHORIZED: {"description": "Não autenticado"}}
_429 = {status.HTTP_429_TOO_MANY_REQUESTS: {"description": "Limite de tentativas por minuto"}}


def _resposta(par: auth.ParDeTokens) -> RespostaLogin:
    return RespostaLogin(
        access_token=par.access_token,
        refresh_token=par.refresh_token,
        user=UsuarioRead.model_validate(par.user),
    )


def _nao_autenticado(detalhe: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detalhe,
        headers={"WWW-Authenticate": "Bearer"},
    )


# O decorador do limitador exige o parâmetro `request` na função.
@router.post(
    "/register",
    status_code=status.HTTP_201_CREATED,
    summary="Cria conta de turista e já entra",
    responses={status.HTTP_409_CONFLICT: {"description": "E-mail já cadastrado"}, **_429},
)
@limiter.limit(LIMITE_REGISTRO)
def registrar(
    request: Request, dados: RegistroIn, db: Annotated[Session, Depends(get_db)]
) -> RespostaLogin:
    try:
        par = auth.registrar(db, nome=dados.name, email=dados.email, senha=dados.password)
    except auth.EmailJaCadastrado as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Já existe uma conta com esse e-mail."
        ) from exc
    return _resposta(par)


@router.post("/login", summary="Entra com e-mail e senha", responses={**_401, **_429})
@limiter.limit(LIMITE_LOGIN)
def entrar(
    request: Request, dados: LoginIn, db: Annotated[Session, Depends(get_db)]
) -> RespostaLogin:
    try:
        par = auth.autenticar(db, email=dados.email, senha=dados.password)
    except auth.CredenciaisInvalidas as exc:
        raise _nao_autenticado(CREDENCIAIS_INVALIDAS) from exc
    return _resposta(par)


@router.post(
    "/refresh",
    summary="Troca o token de renovação por um par novo (rotação)",
    responses=_401,
)
def renovar(dados: RefreshIn, db: Annotated[Session, Depends(get_db)]) -> RespostaLogin:
    """O token apresentado é revogado. Reapresentar um token já revogado derruba todas as
    sessões do usuário (vazamento) e responde 401."""
    try:
        par = auth.renovar(db, refresh_token=dados.refresh_token)
    except auth.SessaoInvalida as exc:
        raise _nao_autenticado(SESSAO_INVALIDA) from exc
    return _resposta(par)


@router.get("/me", summary="Usuário do token de acesso", responses=_401)
def eu(usuario: UsuarioAtual) -> UsuarioRead:
    return UsuarioRead.model_validate(usuario)


@router.post(
    "/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Revoga o token de renovação apresentado",
    responses=_401,
)
def sair(dados: RefreshIn, db: Annotated[Session, Depends(get_db)]) -> Response:
    try:
        auth.encerrar_sessao(db, refresh_token=dados.refresh_token)
    except auth.SessaoInvalida as exc:
        raise _nao_autenticado(SESSAO_INVALIDA) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)
