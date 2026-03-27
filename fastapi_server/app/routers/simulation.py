import random

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.deps.auth import CurrentUser, require_roles
from app.models.models import Account, Transaction
from app.schemas.common import error_response, success_response
from app.services.banking import create_deposit, create_transfer


router = APIRouter(prefix="/simulation", tags=["simulation"])


class RecoverRequest(BaseModel):
    action: str


class BulkRequest(BaseModel):
    count: int | None = 5
    type: str | None = None


@router.post("/success")
def simulate_success(user: CurrentUser = Depends(require_roles("admin", "manager", "teller")), db: Session = Depends(get_db)):
    accounts = db.query(Account).filter(Account.status == "active", Account.balance >= 100).order_by(Account.account_id).limit(50).all()
    if len(accounts) < 2:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error_response("Not enough active accounts for simulation"))

    pair = random.sample(accounts, 2)
    amount = random.randint(50, 550)
    txn, _, _ = create_transfer(db, pair[0].account_id, pair[1].account_id, float(amount), "Simulated successful transfer", user.user_id, user.role)
    if not txn:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=error_response("Failed to simulate successful transaction"))
    db.commit()

    return success_response(
        message="Successful transaction simulated",
        data={"transactionId": txn.transaction_id, "reference": txn.reference_number, "status": txn.status, "amount": amount},
    )


@router.post("/failure")
def simulate_failure(user: CurrentUser = Depends(require_roles("admin", "manager", "teller")), db: Session = Depends(get_db)):
    source = db.query(Account).filter(Account.status == "active").order_by(Account.balance.asc()).first()
    target = db.query(Account).filter(Account.status == "active", Account.account_id != source.account_id).first() if source else None

    if not source or not target:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error_response("No active accounts for simulation"))

    attempted = float(source.balance) + 10000
    txn, _, _ = create_transfer(
        db,
        source.account_id,
        target.account_id,
        attempted,
        "Simulated failed transfer (insufficient funds)",
        user.user_id,
        user.role,
    )
    if not txn:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=error_response("Failed to simulate failed transaction"))
    db.commit()

    return success_response(
        message="Failed transaction simulated",
        data={
            "transactionId": txn.transaction_id,
            "reference": txn.reference_number,
            "status": txn.status,
            "attemptedAmount": attempted,
            "availableBalance": float(source.balance),
        },
    )


@router.post("/stuck")
def simulate_stuck(user: CurrentUser = Depends(require_roles("admin", "manager", "teller")), db: Session = Depends(get_db)):
    accounts = db.query(Account).filter(Account.status == "active", Account.balance >= 100).order_by(Account.account_id).limit(50).all()
    if len(accounts) < 2:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error_response("Not enough active accounts for simulation"))

    pair = random.sample(accounts, 2)
    amount = random.randint(50, 250)

    txn = Transaction(
        reference_number=f"STK{random.randint(1000000000, 9999999999)}",
        from_account_id=pair[0].account_id,
        to_account_id=pair[1].account_id,
        transaction_type="transfer",
        amount=float(amount),
        status="stuck",
        description="Simulated stuck transaction",
        initiated_by=user.user_id,
    )
    db.add(txn)
    db.commit()

    return success_response(
        message="Stuck transaction simulated",
        data={"transactionId": txn.transaction_id, "reference": txn.reference_number, "status": txn.status, "amount": amount},
    )


@router.post("/recover/{transaction_id}")
def recover(
    transaction_id: int,
    payload: RecoverRequest,
    user: CurrentUser = Depends(require_roles("admin", "manager")),
    db: Session = Depends(get_db),
):
    if payload.action not in {"complete", "fail"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error_response('Action must be "complete" or "fail"'))

    txn = db.query(Transaction).filter(Transaction.transaction_id == transaction_id).with_for_update().first()
    if not txn:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error_response("Transaction not found"))
    if txn.status != "stuck":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error_response("Transaction is not stuck"))

    txn.status = "completed" if payload.action == "complete" else "failed"
    db.commit()
    return success_response(message=f"Stuck transaction {payload.action}d successfully", data={"status": txn.status})


@router.post("/deposit")
def simulate_deposit(user: CurrentUser = Depends(require_roles("admin", "manager", "teller")), db: Session = Depends(get_db)):
    account = db.query(Account).filter(Account.status == "active").order_by(Account.account_id).first()
    if not account:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error_response("No active accounts for simulation"))

    amount = random.randint(100, 1100)
    txn, _, _ = create_deposit(db, account.account_id, float(amount), "Simulated cash deposit", user.user_id)
    if not txn:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=error_response("Failed to simulate deposit"))
    db.commit()

    return success_response(
        message="Deposit simulated",
        data={"transactionId": txn.transaction_id, "reference": txn.reference_number, "status": txn.status, "amount": amount},
    )


@router.post("/reversal")
def simulate_reversal(user: CurrentUser = Depends(require_roles("admin", "manager")), db: Session = Depends(get_db)):
    txn = (
        db.query(Transaction)
        .filter(Transaction.status == "completed", Transaction.transaction_type.in_(["transfer", "deposit", "withdrawal"]))
        .order_by(Transaction.created_at.desc())
        .first()
    )
    if not txn:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error_response("No eligible transactions to reverse"))

    from app.routers.reversals import create_reversal, ReversalRequest

    return create_reversal(ReversalRequest(transactionId=txn.transaction_id, reason="Simulated reversal for testing"), user, db)


@router.post("/bulk")
def bulk(
    payload: BulkRequest,
    user: CurrentUser = Depends(require_roles("admin", "manager")),
    db: Session = Depends(get_db),
):
    requested = payload.count or 5
    num_transactions = max(1, min(requested, 20))
    accounts = db.query(Account).filter(Account.status == "active", Account.balance >= 100).order_by(Account.account_id).limit(200).all()

    results: list[dict] = []
    if len(accounts) < 2:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error_response("Not enough active accounts for simulation"))

    for i in range(num_transactions):
        pair = random.sample(accounts, 2)
        amount = random.randint(50, 550)
        txn, _, _ = create_transfer(db, pair[0].account_id, pair[1].account_id, float(amount), f"Bulk simulation {i + 1}", user.user_id, user.role)
        if not txn:
            continue
        results.append(
            {
                "transactionId": txn.transaction_id,
                "reference": txn.reference_number,
                "status": txn.status,
                "amount": amount,
            }
        )

    db.commit()
    return success_response(message=f"Bulk simulation completed: {len(results)} transactions", data=results)
