# Finley ML service

A small FastAPI service that, on every request, fits a lightweight forecasting model on one user's own transaction history
(no external training dataset):

- **Forecaster** (`forecaster.py`): per-envelope projected spend for a month = recurring bills (deterministic)
  + variable spend (Holt-Winters with damped trend for 3+ months of history, weighted moving average for 1-2 months,
  the planned budget when there is no history).

It only ever runs `SELECT` queries (the connection is opened read-only).

## Run locally

```bash
cd ml
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
cp .env.example .env            # then fill in DATABASE_URL and ML_INTERNAL_SECRET
.venv/bin/python -m pytest      # synthetic-data tests, no database needed
.venv/bin/uvicorn main:app --reload --port 8000
```

Check it: `curl http://127.0.0.1:8000/health`

## Connect the Express backend

Set these where the backend runs (local `.env` or Render environment variables):

| Variable | Value |
|---|---|
| `ML_SERVICE_URL` | `http://127.0.0.1:8000` locally, or the ML service's public URL on Render |
| `ML_INTERNAL_SECRET` | the same secret as the ML service |

The backend calls `POST {ML_SERVICE_URL}/forecast` with the `X-Internal-Secret` header and a 5 s timeout. If the service is
down the backend returns `{ available: false }` and the chat just omits the forecast section.

## Deploy on Render (second web service)

- Root directory: `ml`
- Build command: `pip install -r requirements.txt`
- Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- Environment: `DATABASE_URL`, `ML_INTERNAL_SECRET`
