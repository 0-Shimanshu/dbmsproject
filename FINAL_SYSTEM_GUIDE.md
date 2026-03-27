# Final System Guide

## Active System

This project is now implemented with:

- FastAPI backend (`fastapi_server/`)
- SQLAlchemy ORM
- PostgreSQL database
- JWT-based authentication and role checks
- Vanilla JavaScript frontend (`client/`)

## Data Flow

1. Frontend sends requests to `/api/*`.
2. FastAPI routers validate input and authorization.
3. Service layer applies banking rules (limits, approvals, reversals).
4. SQLAlchemy persists and queries data in PostgreSQL.
5. Response payloads are returned to the frontend in compatible shape.

## Core Functional Areas

- Auth and session verification
- Accounts and account holders
- Transactions (deposit/withdraw/transfer)
- Approval workflow for controlled transfers
- Reversals with audit trail
- Logs and reports
- Simulation endpoints for scenario testing

## Operational Notes

- Legacy Node/Express backend has been removed from this repository.
- Keep `.env` values updated for `DATABASE_URL` and `JWT_SECRET`.
- Run service from `fastapi_server/run.py`.
