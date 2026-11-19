"""FastAPI ML microservice: per-envelope expense forecasts (Holt-Winters).

Run locally:   uvicorn main:app --reload --port 8000
The Express backend calls POST /forecast with the X-Internal-Secret header. Nothing is trained ahead of time:
models are fitted on the user's own transaction history on every request, and the database is only ever read.
"""

from __future__ import annotations

import hmac
import os
import re

import psycopg
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException
from psycopg.rows import dict_row
from pydantic import BaseModel, Field

from forecaster import build_forecast, fetch_inputs

load_dotenv()

app = FastAPI(title="Finley ML service", version="1.0.0")

MONTH_RE = re.compile(r"^\d{4}-(0[1-9]|1[0-2])$")


class ForecastRequest(BaseModel):
    user_id: str = Field(min_length=1)
    month: str = Field(description="Target month as YYYY-MM")


def require_secret(x_internal_secret: str | None = Header(default=None)) -> None:
    expected = os.getenv("ML_INTERNAL_SECRET")
    if not expected:
        raise HTTPException(status_code=503, detail="ML_INTERNAL_SECRET is not configured")
    if not x_internal_secret or not hmac.compare_digest(x_internal_secret, expected):
        raise HTTPException(status_code=401, detail="Invalid internal secret")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/forecast", dependencies=[Depends(require_secret)])
def forecast(req: ForecastRequest) -> dict:
    if not MONTH_RE.match(req.month):
        raise HTTPException(status_code=422, detail="month must be formatted as YYYY-MM")

    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise HTTPException(status_code=503, detail="DATABASE_URL is not configured")

    try:
        with psycopg.connect(database_url, row_factory=dict_row, connect_timeout=5) as conn:
            conn.read_only = True  # the service can never write
            categories, expenses, recurring = fetch_inputs(conn, req.user_id, req.month)
    except psycopg.Error as exc:
        raise HTTPException(status_code=503, detail="Database unavailable") from exc

    return build_forecast(categories, expenses, recurring, req.month)
