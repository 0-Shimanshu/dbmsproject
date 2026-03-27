from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.deps.auth import CurrentUser, any_authenticated, require_roles
from app.models.models import Account, Reversal, Transaction
from app.schemas.common import error_response, success_response
from app.services.banking import add_history, generate_reference, log_audit


router = APIRouter(prefix="/reversals", tags=["reversals"])


class ReversalRequest(BaseModel):
    transactionId: int
    reason: str


@router.get("/reversible")
def reversible(_=Depends(any_authenticated), db: Session = Depends(get_db)):
    rows = (
        db.execute(
            text(
                """
                SELECT
                    t.transaction_id,
                    t.reference_number,
                    fa.account_number as from_account,
                    CONCAT(fh.first_name, ' ', fh.last_name) as from_holder,
                    ta.account_number as to_account,
                    CONCAT(th.first_name, ' ', th.last_name) as to_holder,
                    t.transaction_type,
                    t.amount,
                    t.status,
                    t.created_at,
                    t.completed_at
                FROM transactions t
                LEFT JOIN accounts fa ON t.from_account_id = fa.account_id
                LEFT JOIN account_holders fh ON fa.holder_id = fh.holder_id
                LEFT JOIN accounts ta ON t.to_account_id = ta.account_id
                LEFT JOIN account_holders th ON ta.holder_id = th.holder_id
                WHERE t.status = 'completed'
                    AND t.transaction_type IN ('transfer', 'withdrawal', 'deposit')
                    AND NOT EXISTS (
                        SELECT 1 FROM reversals r
                        WHERE r.original_transaction_id = t.transaction_id
                            AND r.status IN ('pending', 'approved', 'completed')
                    )
                    AND t.created_at >= NOW() - INTERVAL '24 hours'
                ORDER BY t.completed_at DESC
                """
            )
        )
        .mappings()
        .all()
    )
    return success_response(data=[dict(r) for r in rows])


@router.get("")
def list_reversals(status_filter: str | None = Query(default=None, alias="status"), _=Depends(any_authenticated), db: Session = Depends(get_db)):
    query = """
        SELECT
            r.*,
            t.reference_number as original_reference,
            t.amount,
            t.transaction_type,
            ur.full_name as requested_by_name,
            ua.full_name as approved_by_name
        FROM reversals r
        JOIN transactions t ON r.original_transaction_id = t.transaction_id
        LEFT JOIN users ur ON r.requested_by = ur.user_id
        LEFT JOIN users ua ON r.approved_by = ua.user_id
        WHERE 1=1
    """
    params: dict[str, object] = {}
    if status_filter:
        query += " AND r.status = :status"
        params["status"] = status_filter
    query += " ORDER BY r.created_at DESC"

    rows = db.execute(text(query), params).mappings().all()
    return success_response(data=[dict(r) for r in rows])


@router.get("/{reversal_id}")
def details(reversal_id: int, _=Depends(any_authenticated), db: Session = Depends(get_db)):
    row = (
        db.execute(
            text(
                """
                SELECT
                    r.*,
                    t.reference_number as original_reference,
                    t.amount,
                    t.transaction_type,
                    t.from_account_id,
                    t.to_account_id,
                    ur.full_name as requested_by_name,
                    ua.full_name as approved_by_name
                FROM reversals r
                JOIN transactions t ON r.original_transaction_id = t.transaction_id
                LEFT JOIN users ur ON r.requested_by = ur.user_id
                LEFT JOIN users ua ON r.approved_by = ua.user_id
                WHERE r.reversal_id = :reversal_id
                """
            ),
            {"reversal_id": reversal_id},
        )
        .mappings()
        .first()
    )

    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=error_response("Reversal not found"))
    return success_response(data=dict(row))


@router.post("")
def create_reversal(
    payload: ReversalRequest,
    user: CurrentUser = Depends(require_roles("admin", "manager")),
    db: Session = Depends(get_db),
):
    original = db.query(Transaction).filter(Transaction.transaction_id == payload.transactionId).with_for_update().first()
    if not original:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error_response("Transaction not found"))
    if original.status != "completed":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error_response("Only completed transactions can be reversed"))
    if original.transaction_type not in {"transfer", "withdrawal", "deposit"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error_response("Transaction type not reversible"))

    existing = (
        db.query(Reversal)
        .filter(Reversal.original_transaction_id == original.transaction_id, Reversal.status.in_(["pending", "approved", "completed"]))
        .first()
    )
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error_response("Transaction already has reversal"))

    debit_account_id = None
    credit_account_id = None

    if original.transaction_type == "transfer":
        debit_account_id = original.to_account_id
        credit_account_id = original.from_account_id
    elif original.transaction_type == "deposit":
        debit_account_id = original.to_account_id
    elif original.transaction_type == "withdrawal":
        credit_account_id = original.from_account_id

    if debit_account_id:
        debit = db.query(Account).filter(Account.account_id == debit_account_id).with_for_update().first()
        if not debit:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error_response("Debit account not found"))
        if float(debit.balance) < float(original.amount):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error_response("Insufficient funds for reversal"))
        debit.balance = float(debit.balance) - float(original.amount)

    if credit_account_id:
        credit = db.query(Account).filter(Account.account_id == credit_account_id).with_for_update().first()
        if not credit:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error_response("Credit account not found"))
        credit.balance = float(credit.balance) + float(original.amount)

    reverse_txn = Transaction(
        reference_number=generate_reference(),
        from_account_id=debit_account_id,
        to_account_id=credit_account_id,
        transaction_type="reversal",
        amount=float(original.amount),
        status="completed",
        description=f"Reversal of {original.reference_number}: {payload.reason}",
        initiated_by=user.user_id,
        approved_by=user.user_id,
        processed_at=datetime.now(timezone.utc),
        completed_at=datetime.now(timezone.utc),
    )
    db.add(reverse_txn)
    db.flush()

    reversal = Reversal(
        original_transaction_id=original.transaction_id,
        reversal_transaction_id=reverse_txn.transaction_id,
        reason=payload.reason,
        status="completed",
        requested_by=user.user_id,
        approved_by=user.user_id,
        processed_at=datetime.now(timezone.utc),
    )
    db.add(reversal)
    original.status = "reversed"

    add_history(db, original.transaction_id, "completed", "reversed", user.user_id, payload.reason)
    add_history(db, reverse_txn.transaction_id, None, "completed", user.user_id, "Reversal transaction completed")
    log_audit(db, user.user_id, "REVERSE_TRANSACTION", "transaction", original.transaction_id, payload.reason)
    db.commit()

    return success_response(
        message="Transaction reversed successfully",
        data={"reversalId": reversal.reversal_id, "status": reversal.status},
    )
