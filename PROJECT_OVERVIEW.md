# Project Overview

## Current Architecture

The Banking Management System now runs on a FastAPI backend with PostgreSQL and SQLAlchemy ORM.

- Frontend: Vanilla HTML/CSS/JavaScript in `client/`
- Backend: FastAPI app in `fastapi_server/`
- Database: PostgreSQL
- Authentication: JWT with role-based access

## Backend Modules

- `fastapi_server/app/routers/auth.py` authentication and token verification
- `fastapi_server/app/routers/dashboard.py` dashboard and health endpoints
- `fastapi_server/app/routers/accounts.py` account and holder operations
- `fastapi_server/app/routers/transactions.py` deposit/withdraw/transfer flows
- `fastapi_server/app/routers/approvals.py` manager/admin approvals
- `fastapi_server/app/routers/reversals.py` reversals and reversal history
- `fastapi_server/app/routers/logs.py` audit log querying
- `fastapi_server/app/routers/reports.py` analytics and reporting endpoints
- `fastapi_server/app/routers/simulation.py` simulation scenarios for testing

## Important Notes

- Legacy Node/Express backend files were removed.
- API base path remains `/api` for frontend compatibility.
- Existing UI in `client/` continues to work with the FastAPI backend.

## Run Instructions

```powershell
cd h:\dbmsproject\fastapi_server
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
python run.py
```
