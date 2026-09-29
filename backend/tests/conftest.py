import os
from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.session import get_db
from app.main import app

RODAR_TESTES_DE_BANCO = bool(os.getenv("RUN_DB_TESTS"))

precisa_de_banco = pytest.mark.skipif(
    not RODAR_TESTES_DE_BANCO, reason="defina RUN_DB_TESTS=1 com o banco no ar"
)


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture(scope="session")
def engine() -> Generator[Engine, None, None]:
    motor = create_engine(get_settings().database_url, pool_pre_ping=True)
    yield motor
    motor.dispose()


@pytest.fixture
def db(engine: Engine) -> Generator[Session, None, None]:
    """Sessão dentro de uma transação que sofre ROLLBACK no fim do teste.

    `join_transaction_mode="create_savepoint"` deixa o código sob teste chamar commit()
    à vontade (o seed chama): o commit fecha um SAVEPOINT, não a transação externa.
    Nada é gravado de verdade, e não precisamos recriar o esquema a cada teste.
    """
    conexao = engine.connect()
    transacao = conexao.begin()
    sessao = Session(bind=conexao, join_transaction_mode="create_savepoint")
    try:
        yield sessao
    finally:
        sessao.close()
        transacao.rollback()
        conexao.close()


@pytest.fixture
def api(db: Session) -> Generator[TestClient, None, None]:
    """Cliente HTTP cujas rotas usam a sessão `db` do teste: veem o que o teste criou e
    tudo some no ROLLBACK do fim."""
    app.dependency_overrides[get_db] = lambda: db
    try:
        with TestClient(app) as cliente:
            yield cliente
    finally:
        app.dependency_overrides.pop(get_db, None)
