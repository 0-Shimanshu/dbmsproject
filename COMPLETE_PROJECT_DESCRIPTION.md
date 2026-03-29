# Complete Project Description - Banking Management System

## 1) Project Purpose

This project is a full-stack **bank management system** built for learning and demonstration of real-world backend concepts using FastAPI and PostgreSQL.

It supports:
- secure login and role-based authorization
- account operations (create, freeze/unfreeze, lookup)
- core transactions (deposit, withdrawal, transfer)
- approval workflow for controlled transfers
- transaction reversals
- audit logs and reports
- simulation APIs for testing operational scenarios

## 2) High-Level Architecture

### Frontend
- Folder: `client/`
- Stack: HTML + CSS + vanilla JavaScript
- Sends API calls to `/api/*` via `client/js/api.js`

### Backend
- Folder: `fastapi_server/`
- Entry: `run.py` -> Uvicorn -> `app.main:app`
- FastAPI routers under `app/routers/`
- Business logic under `app/services/banking.py`

### Database
- PostgreSQL schema file: `sql/schema.sql`
- ORM models: `fastapi_server/app/models/models.py`
- Session/engine config: `fastapi_server/app/db/session.py`

### Request Flow
1. Frontend calls `/api/...`
2. Router validates input and role permissions
3. Service layer applies banking rules and updates DB
4. Response returns in a standard JSON shape (`success_response` / `error_response`)

## 3) Core Modules and Responsibilities

### `app/core/config.py`
- Loads `.env` using `pydantic-settings`
- Central source for host, port, DB URL, JWT settings

### `app/core/security.py`
- JWT token creation and decoding
- Password verification via bcrypt (`passlib`)

### `app/deps/auth.py`
- Extracts `Bearer` token
- Resolves current user from DB
- Enforces role-based access with `require_roles(...)`

### `app/services/banking.py`
Contains core business operations:
- `create_deposit`
- `create_withdrawal`
- `create_transfer`
- `process_approval`
- helper functions for references, audit logs, state history, balance logic

### Routers (`app/routers/`)
- `auth.py` -> login/logout/verify/me
- `dashboard.py` -> summary + health
- `accounts.py` -> account + holder operations
- `transactions.py` -> transaction create/list/detail/history
- `approvals.py` -> pending approvals and process actions
- `reversals.py` -> reversible list + reversal actions
- `logs.py` -> audit logs and filters
- `reports.py` -> analytics endpoints
- `simulation.py` -> generate success/failure/stuck/bulk test scenarios

## 4) Database Design (Important Tables)

### `users`
Stores application users and roles (`admin`, `manager`, `teller`, `auditor`).

### `account_holders`
Stores customer identity/contact details.

### `accounts`
Stores bank account state including:
- `balance`
- `held_balance`
- `status` (`active`, `frozen`, `closed`, `pending`)
- freeze metadata

### `transactions`
Every deposit/withdraw/transfer/reversal event with status lifecycle:
`pending -> processing -> completed` (or `failed`, `reversed`, `stuck`)

### `pending_approvals`
Tracks transfer approvals required for teller daily-limit overflow scenarios.

### `reversals`
Tracks reversal requests and completion status.

### `transaction_history`
Tracks state transitions for each transaction (auditability of status changes).

### `audit_logs`
Tracks user actions for compliance and traceability.

### `system_config`
Runtime configs like:
- daily transfer limit
- minimum balance by account type

## 5) Business Rules Implemented

1. **Positive amount validation** for all monetary operations.
2. **No same-account transfer** (`from == to` blocked).
3. **Account status checks**: transactions require active accounts.
4. **Overdraft-aware balance checks** for transfer/withdrawal.
5. **Teller daily limit rule**:
   - if exceeded, transfer becomes `pending`
   - approval record is created
6. **Manager/Admin approval processing**:
   - approval updates pending transfer to completed or failed
7. **Reversal rule set**:
   - only completed transactions can be reversed
   - reversible types: transfer/deposit/withdrawal
   - prevents duplicate active reversals
8. **Audit + history tracking** at key operations.

## 6) Auth and Role Matrix

### Roles
- **admin**: full access
- **manager**: operational control + approvals/reversals
- **teller**: customer transaction operations (limited by approval rules)
- **auditor**: read-only analysis and logs/reporting views

### Typical restrictions in backend
- Approvals: manager/admin only
- Reversal create: manager/admin only
- Freeze/unfreeze account: manager/admin only
- Deposit/withdraw/transfer: admin/manager/teller

## 7) API Summary (By Functional Area)

### Auth
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/verify`
- `GET /api/auth/me`

### Dashboard
- `GET /api/dashboard/summary`
- `GET /api/dashboard/recent-activity`
- `GET /api/dashboard/transaction-stats`
- `GET /api/dashboard/system-health`

### Accounts
- `GET /api/accounts`
- `GET /api/accounts/{account_id}`
- `GET /api/accounts/number/{account_number}`
- `GET /api/accounts/{account_id}/transactions`
- `GET /api/accounts/holders/list`
- `POST /api/accounts` (create)
- `POST /api/accounts/{account_id}/freeze`
- `POST /api/accounts/{account_id}/unfreeze`

### Transactions
- `GET /api/transactions`
- `GET /api/transactions/{transaction_id}`
- `GET /api/transactions/{transaction_id}/history`
- `POST /api/transactions/deposit`
- `POST /api/transactions/withdraw`
- `POST /api/transactions/transfer`
- status filters: `/status/pending`, `/status/failed`, `/status/stuck`

### Approvals
- `GET /api/approvals/pending`
- `GET /api/approvals/history`
- `GET /api/approvals/{approval_id}`
- `POST /api/approvals/{approval_id}/process`

### Reversals
- `GET /api/reversals`
- `GET /api/reversals/reversible`
- `GET /api/reversals/{reversal_id}`
- `POST /api/reversals`

### Logs + Reports + Simulation
- `GET /api/logs...`
- `GET /api/reports...`
- `POST /api/simulation/...`

## 8) How to Run (Clean Setup)

### Step A: Database
```powershell
psql -U postgres -c "CREATE DATABASE banking_system;"
psql -U postgres -d banking_system -f h:\dbmsproject_fastapi\dbmsproject\sql\schema.sql
```

### Step B: Backend
```powershell
cd h:\dbmsproject_fastapi\dbmsproject\fastapi_server
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
python run.py
```

### Step C: Access
- App + API host: `http://localhost:3000`
- Health check: `http://localhost:3000/api/health`

## 9) Default Users for Demo

- `admin / password123`
- `manager1 / password123`
- `teller1 / password123`
- `auditor1 / password123`

## 10) Common Viva / Interview Questions With Short Answers

1. **Why FastAPI for this project?**  
   FastAPI gives high performance, clean routing, automatic validation support, and easy modular organization.

2. **How is RBAC implemented?**  
   JWT stores user identity/role; dependencies in `deps/auth.py` enforce allowed roles per endpoint.

3. **How do you ensure transaction traceability?**  
   `transaction_history` records state transitions and `audit_logs` records user actions.

4. **How do you handle transfers above teller limits?**  
   Transfer is marked pending, recorded in `pending_approvals`, and requires manager/admin processing.

5. **How are reversals controlled?**  
   Only completed eligible transaction types can be reversed, with duplicate-active reversal prevention.

6. **How does frontend communicate with backend?**  
   Via `fetch` using base URL `/api`, with bearer token attached from local storage.

7. **What are the biggest production improvements you would add next?**  
   stronger secrets management, proper password reset policy, stricter CORS config, idempotency keys, and automated tests.

## 11) Known Limitations / Improvement Ideas

- No refresh-token flow yet (single access token model)
- No background job queue for heavy processing
- Limited automated test coverage in current repository
- CORS is currently permissive (`allow_origins=["*"]`)

## 12) File Map for Fast Revision

- Backend entry: `fastapi_server/run.py`
- App wiring: `fastapi_server/app/main.py`
- Security/JWT: `fastapi_server/app/core/security.py`
- Auth dependencies: `fastapi_server/app/deps/auth.py`
- Business logic: `fastapi_server/app/services/banking.py`
- API routers: `fastapi_server/app/routers/*.py`
- DB schema: `sql/schema.sql`
- Frontend API helper: `client/js/api.js`
- Frontend auth module: `client/js/auth.js`

---

If you study this file end-to-end, you can confidently explain architecture, module roles, workflows, and business rules for most project review questions.