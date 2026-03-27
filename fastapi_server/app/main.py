from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.routers import all_routers


app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for router in all_routers:
    app.include_router(router, prefix="/api")


@app.get("/api/health")
def health():
    import time

    return {"status": "healthy", "timestamp": __import__("datetime").datetime.utcnow().isoformat(), "uptime": time.time()}


project_root = Path(__file__).resolve().parents[2]
client_dir = project_root / "client"
index_html = client_dir / "index.html"

if client_dir.exists():
    app.mount("/", StaticFiles(directory=client_dir, html=True), name="client")


@app.get("/{full_path:path}")
def spa_fallback(full_path: str):
    if full_path.startswith("api"):
        return {"success": False, "message": "Not found"}
    if index_html.exists():
        return FileResponse(index_html)
    return {"success": False, "message": "Client not found"}
