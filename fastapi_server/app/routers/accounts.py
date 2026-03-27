from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.deps.auth import CurrentUser, any_authenticated, require_roles
from app.models.models import Account, AccountHolder, User
from app.schemas.common import error_response, success_response
from app.services.banking import generate_account_number, log_audit


router = APIRouter(prefix="/accounts", tags=["accounts"])


class CreateAccountRequest(BaseModel):
    holderId: int
    accountType: str
    initialDeposit: float = 0


class FreezeRequest(BaseModel):
    reason: str


@router.get("/holders/list")
def list_holders(_=Depends(any_authenticated), db: Session = Depends(get_db)):
    rows = (
        db.execute(
            text(
                """
                SELECT holder_id, first_name, last_name, email, phone, id_number
                FROM account_holders
                ORDER BY first_name, last_name
                """
            )
        )
        .mappings()
        .all()
    )
    return success_response(data=[dict(r) for r in rows])


@router.get("/number/{account_number}")
def get_by_number(account_number: str, _=Depends(any_authenticated), db: Session = Depends(get_db)):
    row = (
        db.execute(
            text(
                """
                SELECT
                    a.account_id,
                    a.account_number,
                    CONCAT(h.first_name, ' ', h.last_name) as holder_name,
                    h.email as holder_email,
                    h.phone as holder_phone,
                    a.account_type,
                    a.balance,
                    a.held_balance,
                    (a.balance - a.held_balance) as available_balance,
                    a.status,
                    a.freeze_reason,
                    a.frozen_at,
                    u.full_name as frozen_by_name,
                    a.interest_rate,
                    a.overdraft_limit,
                    a.created_at,
                    a.updated_at
                FROM accounts a
                JOIN account_holders h ON a.holder_id = h.holder_id
                LEFT JOIN users u ON a.frozen_by = u.user_id
                WHERE a.account_number = :account_number
                """
            ),
            {"account_number": account_number},
        )
        .mappings()
        .first()
    )
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=error_response("Account not found"))
    return success_response(data=dict(row))


@router.get("/{account_id}/transactions")
def account_transactions(account_id: int, _=Depends(any_authenticated), db: Session = Depends(get_db)):
    rows = (
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
                WHERE t.from_account_id = :account_id OR t.to_account_id = :account_id
                ORDER BY t.created_at DESC
                LIMIT 50
                """
            ),
            {"account_id": account_id},
        )
        .mappings()
        .all()
    )
    return success_response(data=[dict(r) for r in rows])


@router.get("")
def list_accounts(
    status_filter: str | None = Query(default=None, alias="status"),
    type_filter: str | None = Query(default=None, alias="type"),
    search: str | None = Query(default=None),
    _=Depends(any_authenticated),
    db: Session = Depends(get_db),
):
    query = """
        SELECT
            a.account_id,
            a.account_number,
            CONCAT(h.first_name, ' ', h.last_name) as holder_name,
            h.email as holder_email,
            h.phone as holder_phone,
            a.account_type,
            a.balance,
            a.held_balance,
            (a.balance - a.held_balance) as available_balance,
            a.status,
            a.freeze_reason,
            a.frozen_at,
            u.full_name as frozen_by_name,
            a.interest_rate,
            a.overdraft_limit,
            a.created_at,
            a.updated_at
        FROM accounts a
        JOIN account_holders h ON a.holder_id = h.holder_id
        LEFT JOIN users u ON a.frozen_by = u.user_id
        WHERE 1=1
    """
    params: dict[str, object] = {}

    if status_filter:
        query += " AND a.status = :status"
        params["status"] = status_filter
    if type_filter:
        query += " AND a.account_type = :account_type"
        params["account_type"] = type_filter
    if search:
        query += " AND (a.account_number ILIKE :search OR CONCAT(h.first_name, ' ', h.last_name) ILIKE :search)"
        params["search"] = f"%{search}%"

    query += " ORDER BY a.created_at DESC"

    rows = db.execute(text(query), params).mappings().all()
    payload = [dict(r) for r in rows]
    return success_response(data=payload, count=len(payload))


@router.get("/{account_id}")
def get_account(account_id: int, _=Depends(any_authenticated), db: Session = Depends(get_db)):
    row = (
        db.execute(
            text(
                """
                SELECT
                    a.account_id,
                    a.account_number,
                    CONCAT(h.first_name, ' ', h.last_name) as holder_name,
                    h.email as holder_email,
                    h.phone as holder_phone,
                    a.account_type,
                    a.balance,
                    a.held_balance,
                    (a.balance - a.held_balance) as available_balance,
                    a.status,
                    a.freeze_reason,
                    a.frozen_at,
                    u.full_name as frozen_by_name,
                    a.interest_rate,
                    a.overdraft_limit,
                    a.created_at,
                    a.updated_at
                FROM accounts a
                JOIN account_holders h ON a.holder_id = h.holder_id
                LEFT JOIN users u ON a.frozen_by = u.user_id
                WHERE a.account_id = :account_id
                """
            ),
            {"account_id": account_id},
        )
        .mappings()
        .first()
    )
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=error_response("Account not found"))
    return success_response(data=dict(row))


@router.post("")
def create_account(
    payload: CreateAccountRequest,
    user: CurrentUser = Depends(require_roles("admin", "manager", "teller")),
    db: Session = Depends(get_db),
):
    holder = db.query(AccountHolder).filter(AccountHolder.holder_id == payload.holderId).first()
    if not holder:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error_response("Account holder not found"))

    min_cfg = db.execute(
        text("SELECT config_value FROM system_config WHERE config_key = :key"),
        {"key": f"min_balance_{payload.accountType}"},
    ).first()
    min_balance = float(min_cfg[0]) if min_cfg and min_cfg[0] is not None else 0.0

    if payload.initialDeposit < min_balance:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_response(f"Minimum initial deposit is {min_balance}"),
        )

    account_number = generate_account_number(db)
    account = Account(
        account_number=account_number,
        holder_id=payload.holderId,
        account_type=payload.accountType,
        balance=payload.initialDeposit,
        status="active",
    )
    db.add(account)
    db.flush()

    log_audit(db, user.user_id, "CREATE_ACCOUNT", "account", account.account_id, "New account created")
    db.commit()

    return success_response(
        message="Account created successfully",
        data={"accountId": account.account_id, "accountNumber": account.account_number},
    )


@router.post("/{account_id}/freeze")
def freeze_account(
    account_id: int,
    payload: FreezeRequest,
    user: CurrentUser = Depends(require_roles("admin", "manager")),
    db: Session = Depends(get_db),
):
    account = db.query(Account).filter(Account.account_id == account_id).with_for_update().first()
    if not account:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error_response("Account not found"))
    if account.status == "frozen":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error_response("Account is already frozen"))
    if account.status == "closed":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error_response("Cannot freeze a closed account"))

    account.status = "frozen"
    account.freeze_reason = payload.reason
    account.frozen_by = user.user_id
    account.frozen_at = __import__("datetime").datetime.utcnow()

    log_audit(db, user.user_id, "FREEZE_ACCOUNT", "account", account.account_id, payload.reason)
    db.commit()

    return success_response(message=f"Account {account.account_number} frozen successfully")


@router.post("/{account_id}/unfreeze")
def unfreeze_account(
    account_id: int,
    payload: FreezeRequest,
    user: CurrentUser = Depends(require_roles("admin", "manager")),
    db: Session = Depends(get_db),
):
    account = db.query(Account).filter(Account.account_id == account_id).with_for_update().first()
    if not account:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error_response("Account not found"))
    if account.status != "frozen":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error_response("Account is not frozen"))

    account.status = "active"
    account.freeze_reason = None
    account.frozen_by = None
    account.frozen_at = None

    log_audit(db, user.user_id, "UNFREEZE_ACCOUNT", "account", account.account_id, payload.reason)
    db.commit()

    return success_response(message=f"Account {account.account_number} unfrozen successfully")
