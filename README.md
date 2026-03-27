# Banking Management System

Production-focused banking management application with a vanilla JS frontend and a Python FastAPI backend.

## Current Tech Stack

- Frontend: HTML, CSS, Vanilla JavaScript
- Backend: FastAPI, SQLAlchemy ORM, Uvicorn
- Database: PostgreSQL
- Auth: JWT (`python-jose`) + password hashing (`passlib[bcrypt]`)

## Project Structure

- `client/` UI pages and modules
- `fastapi_server/` active backend API
- `sql/schema.sql` PostgreSQL schema bootstrap for the FastAPI backend

## Quick Start (FastAPI + PostgreSQL)

```powershell
cd h:\dbmsproject\fastapi_server
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
python run.py
```

API and frontend are served from the same app at `http://localhost:3000`.

Initialize database schema (once):

```powershell
psql -U postgres -d banking_system -f h:\dbmsproject\sql\schema.sql
```

## Environment Variables

Use `fastapi_server/.env`:

```env
APP_NAME=Banking Management System API
ENV=development
HOST=0.0.0.0
PORT=3000
JWT_SECRET=change_me
JWT_EXPIRES_MINUTES=1440
DATABASE_URL=postgresql+psycopg2://postgres:postgres@localhost:5432/banking_system
```

## Core API Areas

- `/api/auth` login/verify/logout
- `/api/dashboard` summary and health data
- `/api/accounts` account and holder operations
- `/api/transactions` deposit, withdraw, transfer, history
- `/api/approvals` manager/admin approval flows
- `/api/reversals` reversal workflows
- `/api/logs` audit log queries
- `/api/reports` operational reporting
- `/api/simulation` transaction simulation scenarios

## Default Test Users

- `admin / password123`
- `manager1 / password123`
- `teller1 / password123`
- `auditor1 / password123`

## Notes

- The frontend API base path remains `/api` for compatibility.
- Legacy Node/Express backend files have been removed from this repository.
