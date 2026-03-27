from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.deps.auth import any_authenticated
from app.schemas.common import success_response


router = APIRouter(prefix="/logs", tags=["logs"])


@router.get("/actions")
def actions(_=Depends(any_authenticated), db: Session = Depends(get_db)):
    rows = db.execute(text("SELECT DISTINCT action FROM audit_logs ORDER BY action")).mappings().all()
    return success_response(data=[r["action"] for r in rows])


@router.get("/entity-types")
def entity_types(_=Depends(any_authenticated), db: Session = Depends(get_db)):
    rows = db.execute(text("SELECT DISTINCT entity_type FROM audit_logs ORDER BY entity_type")).mappings().all()
    return success_response(data=[r["entity_type"] for r in rows])


@router.get("/entity/{entity_type}/{entity_id}")
def entity_logs(entity_type: str, entity_id: int, _=Depends(any_authenticated), db: Session = Depends(get_db)):
    rows = (
        db.execute(
            text(
                """
                SELECT al.log_id, u.username, u.full_name as actor_name, u.role as actor_role, al.action,
                       al.entity_type, al.entity_id, al.old_values, al.new_values, al.reason, al.ip_address, al.created_at
                FROM audit_logs al
                LEFT JOIN users u ON al.user_id = u.user_id
                WHERE al.entity_type = :entity_type AND al.entity_id = :entity_id
                ORDER BY al.created_at DESC
                """
            ),
            {"entity_type": entity_type, "entity_id": entity_id},
        )
        .mappings()
        .all()
    )
    return success_response(data=[dict(r) for r in rows])


@router.get("")
def list_logs(
    action: str | None = Query(default=None),
    entityType: str | None = Query(default=None),
    dateFrom: str | None = Query(default=None),
    dateTo: str | None = Query(default=None),
    limit: int = Query(default=50),
    page: int = Query(default=1),
    _=Depends(any_authenticated),
    db: Session = Depends(get_db),
):
    page_size = max(1, min(limit, 200))
    page_num = max(1, page)
    offset = (page_num - 1) * page_size

    base = """
        FROM audit_logs al
        LEFT JOIN users u ON al.user_id = u.user_id
        WHERE 1=1
    """
    filters = ""
    params: dict[str, object] = {}

    if action:
        filters += " AND al.action = :action"
        params["action"] = action
    if entityType:
        filters += " AND al.entity_type = :entity_type"
        params["entity_type"] = entityType
    if dateFrom:
        filters += " AND DATE(al.created_at) >= :date_from"
        params["date_from"] = dateFrom
    if dateTo:
        filters += " AND DATE(al.created_at) <= :date_to"
        params["date_to"] = dateTo

    count_query = text("SELECT COUNT(*) as total " + base + filters)
    total = db.execute(count_query, params).mappings().first()["total"]

    data_query = text(
        """
        SELECT
            al.log_id,
            u.username,
            u.full_name as actor_name,
            u.role as actor_role,
            al.action,
            al.entity_type,
            al.entity_id,
            al.old_values,
            al.new_values,
            al.reason,
            al.ip_address,
            al.created_at
        """
        + base
        + filters
        + " ORDER BY al.created_at DESC LIMIT :limit OFFSET :offset"
    )

    params.update({"limit": page_size, "offset": offset})
    rows = db.execute(data_query, params).mappings().all()

    return success_response(
        data=[dict(r) for r in rows],
        pagination={
            "page": page_num,
            "pageSize": page_size,
            "total": total,
            "totalPages": (total + page_size - 1) // page_size,
        },
    )
