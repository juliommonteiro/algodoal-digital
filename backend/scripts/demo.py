"""Dados da apresentação (docs/demo.md): catálogo inicial e as contas de demonstração.

    python -m scripts.demo            # cria ou acerta o que faltar; não apaga nada
    python -m scripts.demo --reset    # apaga TODAS as contas, sessões e pedidos de carroça e
                                      # recria as da demonstração (pede confirmação)

Na produção, pelo scripts/demo.sh. Ao contrário do scripts.seed, roda com
ENVIRONMENT=production: as contas daqui são as da apresentação, com senha de demonstração
publicada no docs/demo.md. Já o admin usa ADMIN_EMAIL e ADMIN_PASSWORD (.env.prod), que não
estão no repositório. Quem lê o QR code do banner não pode virar admin.

O reset não mexe no catálogo (locais, estabelecimentos, fotos, categorias), por dois motivos:
- o catálogo é da equipe, corrigido à mão pelo painel admin. Recriar apagaria essas correções;
- o sync dos celulares é incremental (#28). Locais apagados de verdade, e não por soft delete,
  ficariam para sempre no celular de quem já abriu o app.

Num banco sem nenhum local, carrega o catálogo inicial do scripts.seed.
"""

from __future__ import annotations

import argparse
import os
import sys
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

from sqlalchemy import delete, func, select
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import gerar_hash, verificar_senha
from app.db.session import SessionLocal
from app.models import Business, Carrier, Place, RefreshToken, RideRequest, User

# Funções internas do seed, de propósito: o catálogo inicial tem uma fonte só.
from scripts.seed import _ja_tem_catalogo, _seed_businesses, _seed_categories, _seed_places

# Só para a apresentação, e publicada no docs/demo.md. Nunca use para conta de verdade.
SENHA_DA_DEMO = "algodoal-demo"
ADMIN_EMAIL_PADRAO = "admin.demo@example.com"
SENHA_MINIMA_DO_ADMIN = 12
CONFIRMACAO = "RESETAR"

# Estabelecimento do parceiro (o mesmo do parceiro do seed de desenvolvimento). Se a equipe o
# renomeou ou removeu, vai o primeiro estabelecimento parceiro sem dono.
LOCAL_DO_PARCEIRO = "Pousada Maré Mansa"

# Telefones no padrão reservado para ficção: (91) 95555-XXXX.
CONTAS: list[dict[str, Any]] = [
    {"email": "turista.demo@example.com", "name": "Ana Turista", "role": "tourist"},
    {
        "email": "bento.demo@example.com",
        "name": "Bento Carroceiro",
        "role": "carrier",
        "phone": "(91) 95555-0301",
        "carroca": {"display_name": "Carroça do Bento", "capacity": 4},
    },
    {
        "email": "rosa.demo@example.com",
        "name": "Rosa Carroceira",
        "role": "carrier",
        "phone": "(91) 95555-0302",
        "carroca": {"display_name": "Carroça da Rosa", "capacity": 6},
    },
    {"email": "parceiro.demo@example.com", "name": "Célia Parceira", "role": "partner"},
]


class ConfiguracaoDaDemo(RuntimeError):
    """Falta ADMIN_PASSWORD, ou ela é fraca demais."""


@dataclass(frozen=True)
class Admin:
    email: str
    senha: str


@dataclass(frozen=True)
class Resultado:
    contas: list[tuple[str, str]]  # (e-mail, perfil)
    estabelecimento_do_parceiro: str | None
    locais: int


def admin_do_ambiente(ambiente: dict[str, str] | None = None) -> Admin:
    ambiente = os.environ if ambiente is None else ambiente
    email = (ambiente.get("ADMIN_EMAIL") or ADMIN_EMAIL_PADRAO).strip().lower()
    senha = ambiente.get("ADMIN_PASSWORD") or ""
    if len(senha) < SENHA_MINIMA_DO_ADMIN:
        raise ConfiguracaoDaDemo(
            f"Defina ADMIN_PASSWORD no .env.prod, com pelo menos {SENHA_MINIMA_DO_ADMIN} "
            "caracteres (gere com: openssl rand -base64 18)."
        )
    if senha == SENHA_DA_DEMO:
        raise ConfiguracaoDaDemo("ADMIN_PASSWORD não pode ser a senha pública da demonstração.")
    return Admin(email=email, senha=senha)


def _acertar_conta(
    session: Session, *, email: str, nome: str, perfil: str, senha: str, telefone: str | None
) -> User:
    usuario = session.scalar(select(User).where(User.email == email))
    if usuario is None:
        usuario = User(email=email, name=nome)
        session.add(usuario)
    usuario.name = nome
    usuario.role = perfil
    usuario.phone = telefone
    usuario.is_active = True
    # Regrava só se não conferir: o Argon2 gera hash diferente a cada vez.
    if usuario.password_hash is None or not verificar_senha(senha, usuario.password_hash)[0]:
        usuario.password_hash = gerar_hash(senha)
    session.flush()
    return usuario


def _acertar_carroca(usuario: User, definicao: dict[str, Any], telefone: str) -> None:
    carroca = usuario.carrier or Carrier(user_id=usuario.id)
    carroca.display_name = definicao["display_name"]
    carroca.capacity = definicao["capacity"]
    carroca.whatsapp = telefone
    # A apresentação começa com as duas carroças disponíveis e aprovadas.
    carroca.is_available = True
    carroca.is_approved = True
    usuario.carrier = carroca


def _vincular_parceiro(session: Session, parceiro: User) -> str | None:
    """Liga o parceiro a um estabelecimento sem dono. Nunca tira o de outra pessoa."""
    ja_tem = session.scalar(
        select(Place.name).join(Business.place).where(Business.owner_id == parceiro.id)
    )
    if ja_tem is not None:
        return ja_tem
    sem_dono = (
        select(Business)
        .join(Business.place)
        .where(Business.owner_id.is_(None), Place.deleted_at.is_(None))
    )
    negocio = session.scalar(sem_dono.where(Place.name == LOCAL_DO_PARCEIRO)) or session.scalar(
        sem_dono.order_by(Business.is_partner.desc(), Place.name)
    )
    if negocio is None:
        return None
    negocio.owner_id = parceiro.id
    session.flush()
    return negocio.place.name


def preparar(session: Session, admin: Admin) -> Resultado:
    """Deixa o banco pronto para a apresentação sem apagar nada. Rodar duas vezes não duplica."""
    categorias = _seed_categories(session)
    if not _ja_tem_catalogo(session):
        locais = _seed_places(session, categorias)
        _seed_businesses(session, locais, {})

    contas: list[tuple[str, str]] = []
    parceiro: User | None = None
    for definicao in CONTAS:
        telefone = definicao.get("phone")
        usuario = _acertar_conta(
            session,
            email=definicao["email"],
            nome=definicao["name"],
            perfil=definicao["role"],
            senha=SENHA_DA_DEMO,
            telefone=telefone,
        )
        if "carroca" in definicao:
            _acertar_carroca(usuario, definicao["carroca"], telefone)
        if definicao["role"] == "partner":
            parceiro = usuario
        contas.append((usuario.email, usuario.role))

    _acertar_conta(
        session,
        email=admin.email,
        nome="Admin da Demonstração",
        perfil="admin",
        senha=admin.senha,
        telefone=None,
    )
    contas.append((admin.email, "admin"))

    assert parceiro is not None
    estabelecimento = _vincular_parceiro(session, parceiro)
    session.commit()
    total_de_locais = session.scalar(
        select(func.count()).select_from(Place).where(Place.deleted_at.is_(None))
    )
    return Resultado(
        contas=contas, estabelecimento_do_parceiro=estabelecimento, locais=total_de_locais or 0
    )


def o_que_o_reset_apaga(session: Session) -> dict[str, int]:
    def contar(modelo: type) -> int:
        return session.scalar(select(func.count()).select_from(modelo)) or 0

    return {
        "contas": contar(User),
        "sessões": contar(RefreshToken),
        "pedidos de carroça": contar(RideRequest),
        "carroças": contar(Carrier),
        "estabelecimentos com dono": session.scalar(
            select(func.count()).select_from(Business).where(Business.owner_id.is_not(None))
        )
        or 0,
    }


def resetar(session: Session, admin: Admin) -> Resultado:
    """Apaga todas as contas e recria as da demonstração. O banco cuida do resto (ondelete):
    sessões, carroças e pedidos vão junto; os estabelecimentos ficam sem dono."""
    session.execute(delete(RideRequest))
    session.execute(delete(User))
    session.expunge_all()
    return preparar(session, admin)


def confirmar(apaga: dict[str, int], banco: str, perguntar: Callable[[str], str] = input) -> bool:
    print()
    print(f"RESET DA DEMONSTRAÇÃO em {banco}")
    print("Vai apagar:")
    for nome, total in apaga.items():
        print(f"  {nome:<28} {total:>5}")
    print("e recriar só as contas da demonstração. O catálogo (locais e fotos) fica.")
    try:
        resposta = perguntar(f"Digite {CONFIRMACAO} para confirmar: ")
    except EOFError:
        return False
    return resposta.strip() == CONFIRMACAO


def _imprimir(resultado: Resultado) -> None:
    print()
    print(f"Pronto: {resultado.locais} locais no catálogo.")
    print(f"Senha das contas de demonstração: {SENHA_DA_DEMO!r} (admin: a do ADMIN_PASSWORD)")
    for email, perfil in resultado.contas:
        print(f"  {email:<30} {perfil}")
    if resultado.estabelecimento_do_parceiro:
        print(f"Parceiro vinculado a: {resultado.estabelecimento_do_parceiro}")
    else:
        print("AVISO: nenhum estabelecimento sem dono; vincule o parceiro pelo painel admin.")
    print()


def main() -> None:
    argumentos = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    argumentos.add_argument(
        "--reset", action="store_true", help="apaga contas, sessões e pedidos e recria as da demo"
    )
    reset = argumentos.parse_args().reset

    try:
        admin = admin_do_ambiente()
    except ConfiguracaoDaDemo as erro:
        print(f"ERRO: {erro}", file=sys.stderr)
        sys.exit(1)

    banco = make_url(get_settings().database_url).render_as_string(hide_password=True)
    with SessionLocal() as session:
        if reset:
            if not confirmar(o_que_o_reset_apaga(session), banco):
                print("Cancelado. Nada foi apagado.")
                sys.exit(1)
            resultado = resetar(session, admin)
        else:
            resultado = preparar(session, admin)
    _imprimir(resultado)


if __name__ == "__main__":
    main()
