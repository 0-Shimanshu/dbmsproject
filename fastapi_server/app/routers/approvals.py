from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.deps.auth import CurrentUser, require_roles
from app.schemas.common import error_response, success_response
from app.services.banking import process_approval


router = APIRouter(prefix="/approvals", tags=["approvals"])


class ProcessApprovalRequest(BaseModel):
    approve: bool
    rejectionReason: str | None = None


@router.get("/pending")
def pending(_=Depends(require_roles("manager", "admin")), db: Session = Depends(get_db)):
    rows = (
        db.execute(
            text(
                """
                SELECT
                    pa.approval_id,
                    pa.transaction_id,
                    t.reference_number,
                    fa.account_number as from_account_number,
                    CONCAT(fh.first_name, ' ', fh.last_name) as from_holder_name,
                    ta.account_number as to_account_number,
                    CONCAT(th.first_name, ' ', th.last_name) as to_holder_name,
                    pa.amount,
                    pa.description,
                    u.full_name as requested_by_name,
                    pa.created_at,
                    pa.status
                FROM pending_approvals pa
                JOIN transactions t ON pa.transaction_id = t.transaction_id
                JOIN accounts fa ON pa.from_account_id = fa.account_id
                JOIN account_holders fh ON fa.holder_id = fh.holder_id
                JOIN accounts ta ON pa.to_account_id = ta.account_id
                JOIN account_holders th ON ta.holder_id = th.holder_id
                JOIN users u ON pa.requested_by = u.user_id
                WHERE pa.status = 'pending'
                ORDER BY pa.created_at DESC
                """
            )
        )
        .mappings()
        .all()
    )
    return success_response(data=[dict(r) for r in rows])


@router.get("/history")
def history(
    limit: int = Query(default=50),
    offset: int = Query(default=0),
    _=Depends(require_roles("manager", "admin")),
    db: Session = Depends(get_db),
):
    rows = (
        db.execute(
            text(
                """
                SELECT
                    pa.approval_id,
                    pa.transaction_id,
                    t.reference_number,
                    fa.account_number as from_account_number,
                    CONCAT(fh.first_name, ' ', fh.last_name) as from_holder_name,
                    ta.account_number as to_account_number,
                    CONCAT(th.first_name, ' ', th.last_name) as to_holder_name,
                    pa.amount,
                    pa.description,
                    u1.full_name as requested_by_name,
                    u2.full_name as approved_by_name,
                    pa.status,
                    pa.rejection_reason,
                    pa.created_at,
                    pa.processed_at
                FROM pending_approvals pa
                JOIN transactions t ON pa.transaction_id = t.transaction_id
                JOIN accounts fa ON pa.from_account_id = fa.account_id
                JOIN account_holders fh ON fa.holder_id = fh.holder_id
                JOIN accounts ta ON pa.to_account_id = ta.account_id
                JOIN account_holders th ON ta.holder_id = th.holder_id
                JOIN users u1 ON pa.requested_by = u1.user_id
                LEFT JOIN users u2 ON pa.approved_by = u2.user_id
                WHERE pa.status IN ('approved', 'rejected')
                ORDER BY pa.processed_at DESC
                LIMIT :limit OFFSET :offset
                """
            ),
            {"limit": max(1, min(limit, 500)), "offset": max(0, offset)},
        )
        .mappings()
        .all()
    )
    return success_response(data=[dict(r) for r in rows])


@router.get("/{approval_id}")
def details(approval_id: int, _=Depends(require_roles("manager", "admin")), db: Session = Depends(get_db)):
    row = (
        db.execute(
            text(
                """
                SELECT
                    pa.approval_id,
                    pa.transaction_id,
                    t.reference_number,
                    pa.from_account_id,
                    fa.account_number as from_account_number,
                    CONCAT(fh.first_name, ' ', fh.last_name) as from_holder_name,
                    fh.email as from_holder_email,
                    pa.to_account_id,
                    ta.account_number as to_account_number,
                    CONCAT(th.first_name, ' ', th.last_name) as to_holder_name,
                    th.email as to_holder_email,
                    pa.amount,
                    pa.description,
                    u1.full_name as requested_by_name,
                    u2.full_name as approved_by_name,
                    pa.status,
                    pa.rejection_reason,
                    pa.created_at,
                    pa.processed_at,
                    t.status as transaction_status
                FROM pending_approvals pa
                JOIN transactions t ON pa.transaction_id = t.transaction_id
                JOIN accounts fa ON pa.from_account_id = fa.account_id
                JOIN account_holders fh ON fa.holder_id = fh.holder_id
                JOIN accounts ta ON pa.to_account_id = ta.account_id
                JOIN account_holders th ON ta.holder_id = th.holder_id
                JOIN users u1 ON pa.requested_by = u1.user_id
                LEFT JOIN users u2 ON pa.approved_by = u2.user_id
                WHERE pa.approval_id = :approval_id
                """
            ),
            {"approval_id": approval_id},
        )
        .mappings()
        .first()
    )
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=error_response("Approval request not found"))
    return success_response(data=dict(row))


@router.post("/{approval_id}/process")
def process(
    approval_id: int,
    payload: ProcessApprovalRequest,
    user: CurrentUser = Depends(require_roles("manager", "admin")),
    db: Session = Depends(get_db),
):
    if not payload.approve and not payload.rejectionReason:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error_response("Rejection reason is required when rejecting"))

    status_value, message = process_approval(db, approval_id, payload.approve, payload.rejectionReason, user.user_id)
    db.commit()

    if status_value in {"completed", "rejected"}:
        return success_response(status=status_value, message=message)

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail={"success": False, "status": status_value, "message": message},
    )
