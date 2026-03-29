# Banking Management System (FastAPI + PostgreSQL)

A production-style banking management platform with a single FastAPI server that serves both:
- REST API (`/api/*`)
- Vanilla JavaScript frontend (`client/`)

This project demonstrates core banking operations, role-based authorization, approval workflows, reversals, audit logs, reporting, and simulation scenarios.

## Tech Stack

- **Backend:** FastAPI, SQLAlchemy 2.x, Uvicorn
- **Database:** PostgreSQL (`psycopg2-binary`)
- **Authentication:** JWT (`python-jose`) + password hashing (`passlib[bcrypt]`)
- **Frontend:** HTML, CSS, Vanilla JavaScript

## Key Features

- User login/logout with JWT token verification
- Role-based access: `admin`, `manager`, `teller`, `auditor`
- Account listing, search, creation, freeze/unfreeze
- Deposits, withdrawals, and transfers
- Teller transfer approval flow when daily limit is exceeded
- Transaction reversal flow with history trail
- Full audit log and reporting endpoints
- Transaction simulation (success/failure/stuck/recovery/bulk)

## Repository Structure

- `client/` frontend pages, styles, and feature modules
- `fastapi_server/` active FastAPI backend
- `sql/schema.sql` PostgreSQL schema + seed data
- `COMPLETE_PROJECT_DESCRIPTION.md` full study guide (architecture + workflows + Q&A)

## Quick Start (Windows / PowerShell)

### 1) Create DB and schema

```powershell
psql -U postgres -c "CREATE DATABASE banking_system;"
psql -U postgres -d banking_system -f h:\dbmsproject_fastapi\dbmsproject\sql\schema.sql
```

### 2) Setup backend

```powershell
cd h:\dbmsproject_fastapi\dbmsproject\fastapi_server
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
python run.py
```

### 3) Open app

- App URL: `http://localhost:3000`
- API health: `http://localhost:3000/api/health`

## Environment Variables (`fastapi_server/.env`)

```env
APP_NAME=Banking Management System API
ENV=development
HOST=0.0.0.0
PORT=3000
JWT_SECRET=change_me_to_a_long_random_secret
JWT_EXPIRES_MINUTES=1440
DATABASE_URL=postgresql+psycopg2://postgres:postgres@localhost:5432/banking_system
```

## Default Login Users

After running `sql/schema.sql`, use:

- `admin / password123`
- `manager1 / password123`
- `teller1 / password123`
- `auditor1 / password123`

## API Domains

- `/api/auth` - login, logout, session verify
- `/api/dashboard` - summary, recent activity, system health
- `/api/accounts` - account and holder operations
- `/api/transactions` - transaction operations and history
- `/api/approvals` - manager/admin approval workflow
- `/api/reversals` - transaction reversal operations
- `/api/logs` - audit log browsing and filters
- `/api/reports` - analytics and KPI endpoints
- `/api/simulation` - test scenario generation/recovery

## Development Notes

- Frontend is served by FastAPI static mount from `client/`
- API base path is `/api` and already wired in `client/js/api.js`
- SQL schema is currently the source of truth for DB structure and seed users

## Documentation

- GitHub overview: this file (`README.md`)
- Complete project study guide: `COMPLETE_PROJECT_DESCRIPTION.md`

## Legacy Docs

Legacy docs were consolidated; older markdown files now point to the two docs above.