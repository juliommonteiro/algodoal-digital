from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.session import get_db

router = APIRouter(tags=["health"])


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "environment": get_settings().environment}


@router.get("/health/db")
def health_db(db: Annotated[Session, Depends(get_db)]) -> dict[str, str]:
    try:
        db.execute(text("SELECT 1"))
    except Exception as exc:  # pragma: no cover - depende da infra
        raise HTTPException(status_code=503, detail="database unavailable") from exc
    return {"status": "ok", "database": "up"}
