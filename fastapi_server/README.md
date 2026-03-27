# FastAPI Backend

Active backend for the Banking Management System.

## Tech & Tools

- Python 3.10+
- FastAPI
- SQLAlchemy 2.x
- PostgreSQL via `psycopg2-binary`
- JWT via `python-jose`
- Password hashing via `passlib[bcrypt]`
- Uvicorn server
- Settings via `pydantic-settings` and `.env`

## Setup

```powershell
cd h:\dbmsproject\fastapi_server
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
```

Update `DATABASE_URL` and `JWT_SECRET` in `.env`.

Initialize the PostgreSQL schema:

```powershell
psql -U postgres -d banking_system -f h:\dbmsproject\sql\schema.sql
```

## Run

```powershell
python run.py
```

- API base path: `/api`
- Health check: `/api/health`
- App URL (default): `http://localhost:3000`

## Main Code Layout

- `app/main.py` app entry and router registration
- `app/core/` settings and security helpers
- `app/db/` SQLAlchemy engine/session
- `app/models/` ORM models
- `app/deps/` auth and role dependencies
- `app/services/` banking business logic
- `app/routers/` domain API routes

## Compatibility

Routes are designed to keep the same frontend-facing API shape used by the existing `client/` app.
