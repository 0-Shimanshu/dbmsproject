# Migrator Folder

This folder is no longer used by the active backend.

## Current Status

- The running backend is `fastapi_server/`.
- Database access is handled through SQLAlchemy + PostgreSQL.
- JWT auth and role-based access are implemented in the FastAPI app.

## Recommendation

If you do not plan to add migration tooling here, this folder can be removed entirely.