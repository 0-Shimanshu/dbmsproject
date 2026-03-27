from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.deps.auth import CurrentUser, any_authenticated, require_roles
from app.schemas.common import error_response, success_response
from app.services.banking import create_deposit, create_transfer, create_withdrawal


router = APIRouter(prefix="/transactions", tags=["transactions"])


class DepositWithdrawRequest(BaseModel):
    accountId: int
    amount: float
    description: str | None = None


class TransferRequest(BaseModel):
    fromAccountId: int
    toAccountId: int
    amount: float
    description: str | None = None


@router.get("/status/pending")
def pending(_=Depends(any_authenticated), db: Session = Depends(get_db)):
    rows = db.execute(text("SELECT * FROM transactions WHERE status = 'pending' ORDER BY created_at DESC")).mappings().all()
    return success_response(data=[dict(r) for r in rows])


@router.get("/status/failed")
def failed(today: str | None = Query(default=None), _=Depends(any_authenticated), db: Session = Depends(get_db)):
    query = "SELECT * FROM transactions WHERE status = 'failed'"
    params: dict[str, object] = {}
    if today == "true":
        query += " AND DATE(created_at) = CURRENT_DATE"
    query += " ORDER BY created_at DESC"
    rows = db.execute(text(query), params).mappings().all()
    return success_response(data=[dict(r) for r in rows])


@router.get("/status/stuck")
def stuck(_=Depends(any_authenticated), db: Session = Depends(get_db)):
    rows = db.execute(text("SELECT * FROM transactions WHERE status = 'stuck' ORDER BY created_at DESC")).mappings().all()
    return success_response(data=[dict(r) for r in rows])


@router.get("")
def list_transactions(
    status_filter: str | None = Query(default=None, alias="status"),
    type_filter: str | None = Query(default=None, alias="type"),
    date_from: str | None = Query(default=None, alias="dateFrom"),
    date_to: str | None = Query(default=None, alias="dateTo"),
    limit: int = Query(default=100),
    _=Depends(any_authenticated),
    db: Session = Depends(get_db),
):
    query = """
        SELECT
            t.transaction_id,
            t.reference_number,
            fa.account_number as from_account,
            fh.first_name as from_holder_first,
            fh.last_name as from_holder_last,
            ta.account_number as to_account,
            th.first_name as to_holder_first,
            th.last_name as to_holder_last,
            t.transaction_type,
            t.amount,
            t.status,
            t.description,
            ui.full_name as initiated_by_name,
            ua.full_name as approved_by_name,
            t.failure_reason,
            t.created_at,
            t.processed_at,
            t.completed_at
        FROM transactions t
        LEFT JOIN accounts fa ON t.from_account_id = fa.account_id
        LEFT JOIN account_holders fh ON fa.holder_id = fh.holder_id
        LEFT JOIN accounts ta ON t.to_account_id = ta.account_id
        LEFT JOIN account_holders th ON ta.holder_id = th.holder_id
        LEFT JOIN users ui ON t.initiated_by = ui.user_id
        LEFT JOIN users ua ON t.approved_by = ua.user_id
        WHERE 1=1
    """
    params: dict[str, object] = {}

    if status_filter:
        query += " AND t.status = :status"
        params["status"] = status_filter
    if type_filter:
        query += " AND t.transaction_type = :txn_type"
        params["txn_type"] = type_filter
    if date_from:
        query += " AND DATE(t.created_at) >= :date_from"
        params["date_from"] = date_from
    if date_to:
        query += " AND DATE(t.created_at) <= :date_to"
        params["date_to"] = date_to

    query += " ORDER BY t.created_at DESC LIMIT :limit"
    params["limit"] = max(1, min(limit, 500))

    rows = db.execute(text(query), params).mappings().all()
    payload = [dict(r) for r in rows]
    return success_response(data=payload, count=len(payload))


@router.get("/{transaction_id}/history")
def transaction_history(transaction_id: int, _=Depends(any_authenticated), db: Session = Depends(get_db)):
    rows = (
        db.execute(
            text(
                """
                SELECT th.*, u.full_name as changed_by_name
                FROM transaction_history th
                LEFT JOIN users u ON th.changed_by = u.user_id
                WHERE th.transaction_id = :transaction_id
                ORDER BY th.created_at ASC
                """
            ),
            {"transaction_id": transaction_id},
        )
        .mappings()
        .all()
    )
    return success_response(data=[dict(r) for r in rows])


@router.get("/{transaction_id}")
def transaction_details(transaction_id: int, _=Depends(any_authenticated), db: Session = Depends(get_db)):
    txn = (
        db.execute(
            text(
                """
                SELECT
                    t.transaction_id,
                    t.reference_number,
                    fa.account_number as from_account,
                    fh.first_name as from_holder_first,
                    fh.last_name as from_holder_last,
                    ta.account_number as to_account,
                    th.first_name as to_holder_first,
                    th.last_name as to_holder_last,
                    t.transaction_type,
                    t.amount,
                    t.status,
                    t.description,
                    ui.full_name as initiated_by_name,
                    ua.full_name as approved_by_name,
                    t.failure_reason,
                    t.created_at,
                    t.processed_at,
                    t.completed_at
                FROM transactions t
                LEFT JOIN accounts fa ON t.from_account_id = fa.account_id
                LEFT JOIN account_holders fh ON fa.holder_id = fh.holder_id
                LEFT JOIN accounts ta ON t.to_account_id = ta.account_id
                LEFT JOIN account_holders th ON ta.holder_id = th.holder_id
                LEFT JOIN users ui ON t.initiated_by = ui.user_id
                LEFT JOIN users ua ON t.approved_by = ua.user_id
                WHERE t.transaction_id = :transaction_id
                """
            ),
            {"transaction_id": transaction_id},
        )
        .mappings()
        .first()
    )
    if not txn:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=error_response("Transaction not found"))

    history = (
        db.execute(
            text(
                """
                SELECT th.*, u.full_name as changed_by_name
                FROM transaction_history th
                LEFT JOIN users u ON th.changed_by = u.user_id
                WHERE th.transaction_id = :transaction_id
                ORDER BY th.created_at ASC
                """
            ),
            {"transaction_id": transaction_id},
        )
        .mappings()
        .all()
    )

    payload = dict(txn)
    payload["history"] = [dict(h) for h in history]
    return success_response(data=payload)


@router.post("/deposit")
def deposit(
    payload: DepositWithdrawRequest,
    user: CurrentUser = Depends(require_roles("admin", "manager", "teller")),
    db: Session = Depends(get_db),
):
    txn, status_value, message = create_deposit(db, payload.accountId, payload.amount, payload.description or "Cash deposit", user.user_id)
    db.commit()

    if not txn:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=error_response("Failed to process deposit"))

    if status_value == "failed":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error_response(message))

    return success_response(
        message=message,
        data={
            "transactionId": txn.transaction_id,
            "reference": txn.reference_number,
            "status": txn.status,
        },
    )


@router.post("/withdraw")
def withdraw(
    payload: DepositWithdrawRequest,
    user: CurrentUser = Depends(require_roles("admin", "manager", "teller")),
    db: Session = Depends(get_db),
):
    txn, status_value, message = create_withdrawal(db, payload.accountId, payload.amount, payload.description or "Cash withdrawal", user.user_id)
    db.commit()

    if not txn:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=error_response("Failed to process withdrawal"))

    if status_value == "failed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "success": False,
                "message": message,
                "data": {
                    "transactionId": txn.transaction_id if txn else None,
                    "reference": txn.reference_number if txn else None,
                    "status": txn.status if txn else "failed",
                },
            },
        )

    return success_response(
        message=message,
        data={
            "transactionId": txn.transaction_id,
            "reference": txn.reference_number,
            "status": txn.status,
        },
    )


@router.post("/transfer")
def transfer(
    payload: TransferRequest,
    user: CurrentUser = Depends(require_roles("admin", "manager", "teller")),
    db: Session = Depends(get_db),
):
    txn, status_value, message = create_transfer(
        db,
        payload.fromAccountId,
        payload.toAccountId,
        payload.amount,
        payload.description or "Fund transfer",
        user.user_id,
        user.role,
    )
    db.commit()

    if not txn:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=error_response("Failed to process transfer"))

    if status_value == "failed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "success": False,
                "message": message,
                "data": {
                    "transactionId": txn.transaction_id if txn else None,
                    "reference": txn.reference_number if txn else None,
                    "status": txn.status if txn else "failed",
                },
            },
        )

    return success_response(
        message=message,
        data={
            "transactionId": txn.transaction_id,
            "reference": txn.reference_number,
            "status": txn.status,
        },
    )
