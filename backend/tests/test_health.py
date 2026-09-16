import os

import pytest


def test_health_ok(client):
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


@pytest.mark.db
@pytest.mark.skipif(not os.getenv("RUN_DB_TESTS"), reason="defina RUN_DB_TESTS=1 com o banco no ar")
def test_health_db(client):
    response = client.get("/api/v1/health/db")
    assert response.status_code == 200
    assert response.json()["database"] == "up"
