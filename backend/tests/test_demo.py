"""Dados da apresentação (scripts/demo.py, docs/demo.md)."""

import pytest
from sqlalchemy import func, select

from app.core.config import get_settings
from app.core.security import gerar_hash, verificar_senha
from app.models import Business, Carrier, Place, RefreshToken, RideRequest, User
from scripts.demo import (
    CONFIRMACAO,
    SENHA_DA_DEMO,
    Admin,
    ConfiguracaoDaDemo,
    admin_do_ambiente,
    confirmar,
    preparar,
    resetar,
)
from tests.conftest import precisa_de_banco

ADMIN = Admin(email="admin.teste-demo@example.com", senha="senha-do-admin-de-teste")


def _por_email(db, email: str) -> User:
    return db.scalar(select(User).where(User.email == email))


# ---------------------------------------------------------------------------- sem banco


def test_admin_exige_senha_no_ambiente():
    with pytest.raises(ConfiguracaoDaDemo, match="ADMIN_PASSWORD"):
        admin_do_ambiente({})
    with pytest.raises(ConfiguracaoDaDemo, match="ADMIN_PASSWORD"):
        admin_do_ambiente({"ADMIN_PASSWORD": "curta"})


def test_admin_nao_usa_a_senha_publica_da_demo():
    with pytest.raises(ConfiguracaoDaDemo, match="pública"):
        admin_do_ambiente({"ADMIN_PASSWORD": SENHA_DA_DEMO})


def test_admin_do_ambiente_normaliza_email():
    admin = admin_do_ambiente({"ADMIN_EMAIL": " Gestor@Example.com ", "ADMIN_PASSWORD": "x" * 16})

    assert admin == Admin(email="gestor@example.com", senha="x" * 16)


@pytest.mark.parametrize("resposta", ["", "sim", "resetar", "RESET"])
def test_reset_so_com_a_palavra_exata(resposta):
    assert confirmar({}, "banco", perguntar=lambda _: resposta) is False


def test_reset_confirmado():
    assert confirmar({}, "banco", perguntar=lambda _: f"  {CONFIRMACAO} ") is True


def test_sem_terminal_o_reset_nao_acontece():
    def sem_entrada(_):
        raise EOFError

    assert confirmar({}, "banco", perguntar=sem_entrada) is False


# ---------------------------------------------------------------------------- com banco


@pytest.mark.db
@precisa_de_banco
def test_preparar_cria_as_contas_da_apresentacao(db, monkeypatch):
    # Ao contrário do seed, a demo roda em produção.
    monkeypatch.setattr(get_settings(), "environment", "production")

    resultado = preparar(db, ADMIN)

    perfis = sorted(perfil for _, perfil in resultado.contas)
    assert perfis == ["admin", "carrier", "carrier", "partner", "tourist"]
    assert resultado.locais > 0
    for email, _ in resultado.contas:
        usuario = _por_email(db, email)
        senha = ADMIN.senha if email == ADMIN.email else SENHA_DA_DEMO
        assert usuario.is_active
        assert verificar_senha(senha, usuario.password_hash)[0]

    carrocas = db.scalars(
        select(Carrier).join(Carrier.user).where(User.email.like("%.demo@example.com"))
    ).all()
    assert len(carrocas) == 2
    assert all(c.is_available and c.is_approved for c in carrocas)

    parceiro = _por_email(db, "parceiro.demo@example.com")
    negocio = db.scalar(select(Business).where(Business.owner_id == parceiro.id))
    assert negocio is not None
    assert negocio.place.name == resultado.estabelecimento_do_parceiro


@pytest.mark.db
@precisa_de_banco
def test_preparar_e_idempotente_e_volta_as_carrocas_para_disponivel(db):
    preparar(db, ADMIN)
    bento = _por_email(db, "bento.demo@example.com")
    bento.carrier.is_available = False
    db.commit()
    usuarios_antes = db.scalar(select(func.count()).select_from(User))
    locais_antes = db.scalar(select(func.count()).select_from(Place))

    preparar(db, ADMIN)

    assert db.scalar(select(func.count()).select_from(User)) == usuarios_antes
    assert db.scalar(select(func.count()).select_from(Place)) == locais_antes
    assert _por_email(db, "bento.demo@example.com").carrier.is_available


@pytest.mark.db
@precisa_de_banco
def test_parceiro_nao_toma_estabelecimento_de_outro_dono(db):
    preparar(db, ADMIN)
    parceiro = _por_email(db, "parceiro.demo@example.com")
    negocio = db.scalar(select(Business).where(Business.owner_id == parceiro.id))
    dona = User(name="Dona de Verdade", email="dona.real@example.com", role="partner")
    db.add(dona)
    db.flush()
    negocio.owner_id = dona.id
    db.commit()

    resultado = preparar(db, ADMIN)

    assert db.get(Business, negocio.id).owner_id == dona.id
    assert resultado.estabelecimento_do_parceiro != negocio.place.name


@pytest.mark.db
@precisa_de_banco
def test_reset_apaga_contas_e_pedidos_e_mantem_o_catalogo(db):
    preparar(db, ADMIN)
    turista = _por_email(db, "turista.demo@example.com")
    turista.password_hash = gerar_hash("senha-trocada-no-ensaio")
    visitante = User(name="Visitante do ensaio", email="visitante@example.com", role="tourist")
    db.add(visitante)
    db.flush()
    db.add(
        RideRequest(
            tourist_id=visitante.id,
            origin="Trapiche",
            destination="Praia da Princesa",
            passengers=2,
            tourist_whatsapp="(91) 95555-0399",
        )
    )
    db.commit()
    locais_antes = set(db.scalars(select(Place.id)))

    resultado = resetar(db, ADMIN)

    emails = set(db.scalars(select(User.email)))
    assert emails == {email for email, _ in resultado.contas}
    assert db.scalar(select(func.count()).select_from(RideRequest)) == 0
    assert db.scalar(select(func.count()).select_from(RefreshToken)) == 0
    assert set(db.scalars(select(Place.id))) == locais_antes
    turista = _por_email(db, "turista.demo@example.com")
    assert verificar_senha(SENHA_DA_DEMO, turista.password_hash)[0]
    assert resultado.estabelecimento_do_parceiro is not None
