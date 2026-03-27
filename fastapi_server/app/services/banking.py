import random
from datetime import date, datetime, timezone

from sqlalchemy import and_, func
from sqlalchemy.orm import Session

from app.models.models import (
    Account,
    AuditLog,
    PendingApproval,
    Reversal,
    SystemConfig,
    Transaction,
    TransactionHistory,
)


def generate_reference() -> str:
    return f"TXN{datetime.now().strftime('%Y%m%d%H%M%S')}{random.randint(1000, 9999)}"


def generate_account_number(db: Session) -> str:
    while True:
        candidate = f"1001{random.randint(0, 99999999):08d}"
        exists = db.query(Account.account_id).filter(Account.account_number == candidate).first()
        if not exists:
            return candidate


def available_balance(account: Account) -> float:
    return float(account.balance) - float(account.held_balance)


def log_audit(db: Session, user_id: int | None, action: str, entity_type: str, entity_id: int | None, reason: str | None = None):
    db.add(
        AuditLog(
            user_id=user_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            reason=reason,
        )
    )


def add_history(db: Session, transaction_id: int, from_state: str | None, to_state: str, changed_by: int | None, reason: str | None):
    db.add(
        TransactionHistory(
            transaction_id=transaction_id,
            from_state=from_state,
            to_state=to_state,
            changed_by=changed_by,
            reason=reason,
        )
    )


def get_daily_transfer_limit(db: Session) -> float:
    config = db.query(SystemConfig).filter(SystemConfig.config_key == "daily_transfer_limit").first()
    if not config or config.config_value is None:
        return 50000.0
    try:
        return float(config.config_value)
    except ValueError:
        return 50000.0


def today_transfer_total(db: Session, account_id: int) -> float:
    total = (
        db.query(func.coalesce(func.sum(Transaction.amount), 0))
        .filter(
            and_(
                Transaction.from_account_id == account_id,
                Transaction.transaction_type == "transfer",
                Transaction.status == "completed",
                func.date(Transaction.created_at) == date.today(),
            )
        )
        .scalar()
    )
    return float(total or 0)


def lock_account(db: Session, account_id: int) -> Account | None:
    return db.query(Account).filter(Account.account_id == account_id).with_for_update().first()


def create_deposit(db: Session, account_id: int, amount: float, description: str, user_id: int):
    if amount <= 0:
        return None, "failed", "Amount must be greater than zero"

    account = lock_account(db, account_id)
    if not account:
        return None, "failed", "Account not found"
    if account.status != "active":
        return None, "failed", f"Account is {account.status}"

    reference = generate_reference()
    txn = Transaction(
        reference_number=reference,
        to_account_id=account_id,
        transaction_type="deposit",
        amount=amount,
        status="processing",
        description=description,
        initiated_by=user_id,
        processed_at=datetime.now(timezone.utc),
    )
    db.add(txn)
    db.flush()

    add_history(db, txn.transaction_id, "pending", "processing", user_id, "Deposit initiated")
    account.balance = float(account.balance) + amount
    txn.status = "completed"
    txn.completed_at = datetime.now(timezone.utc)
    add_history(db, txn.transaction_id, "processing", "completed", user_id, "Deposit completed")
    log_audit(db, user_id, "DEPOSIT", "transaction", txn.transaction_id, "Deposit processed")

    return txn, "completed", "Deposit successful"


def create_withdrawal(db: Session, account_id: int, amount: float, description: str, user_id: int):
    if amount <= 0:
        return None, "failed", "Amount must be greater than zero"

    account = lock_account(db, account_id)
    if not account:
        return None, "failed", "Account not found"
    if account.status != "active":
        return None, "failed", f"Account is {account.status}"

    reference = generate_reference()
    if amount > (available_balance(account) + float(account.overdraft_limit)):
        txn = Transaction(
            reference_number=reference,
            from_account_id=account_id,
            transaction_type="withdrawal",
            amount=amount,
            status="failed",
            description=description,
            initiated_by=user_id,
            failure_reason="Insufficient funds",
        )
        db.add(txn)
        db.flush()
        return txn, "failed", "Insufficient funds"

    txn = Transaction(
        reference_number=reference,
        from_account_id=account_id,
        transaction_type="withdrawal",
        amount=amount,
        status="processing",
        description=description,
        initiated_by=user_id,
        processed_at=datetime.now(timezone.utc),
    )
    db.add(txn)
    db.flush()

    add_history(db, txn.transaction_id, "pending", "processing", user_id, "Withdrawal initiated")
    account.balance = float(account.balance) - amount
    txn.status = "completed"
    txn.completed_at = datetime.now(timezone.utc)
    add_history(db, txn.transaction_id, "processing", "completed", user_id, "Withdrawal completed")
    log_audit(db, user_id, "WITHDRAWAL", "transaction", txn.transaction_id, "Withdrawal processed")

    return txn, "completed", "Withdrawal successful"


def create_transfer(db: Session, from_account_id: int, to_account_id: int, amount: float, description: str, user_id: int, user_role: str):
    if from_account_id == to_account_id:
        return None, "failed", "Cannot transfer to the same account"
    if amount <= 0:
        return None, "failed", "Amount must be greater than zero"

    from_account = lock_account(db, from_account_id)
    to_account = lock_account(db, to_account_id)
    if not from_account:
        return None, "failed", "Source account not found"
    if not to_account:
        return None, "failed", "Destination account not found"
    if from_account.status != "active":
        return None, "failed", f"Source account is {from_account.status}"
    if to_account.status != "active":
        return None, "failed", f"Destination account is {to_account.status}"

    reference = generate_reference()
    if amount > (available_balance(from_account) + float(from_account.overdraft_limit)):
        txn = Transaction(
            reference_number=reference,
            from_account_id=from_account_id,
            to_account_id=to_account_id,
            transaction_type="transfer",
            amount=amount,
            status="failed",
            description=description,
            initiated_by=user_id,
            failure_reason="Insufficient funds",
        )
        db.add(txn)
        db.flush()
        return txn, "failed", "Insufficient funds"

    daily_limit = get_daily_transfer_limit(db)
    daily_total = today_transfer_total(db, from_account_id)

    if user_role == "teller" and (daily_total + amount) > daily_limit:
        txn = Transaction(
            reference_number=reference,
            from_account_id=from_account_id,
            to_account_id=to_account_id,
            transaction_type="transfer",
            amount=amount,
            status="pending",
            description=description,
            initiated_by=user_id,
        )
        db.add(txn)
        db.flush()

        db.add(
            PendingApproval(
                transaction_id=txn.transaction_id,
                from_account_id=from_account_id,
                to_account_id=to_account_id,
                amount=amount,
                description=description,
                requested_by=user_id,
                status="pending",
            )
        )

        add_history(db, txn.transaction_id, None, "pending", user_id, "Transfer requires manager approval")
        log_audit(db, user_id, "TRANSFER_REQUEST", "transaction", txn.transaction_id, "Transfer requires approval")

        return txn, "pending", f"Transfer requires manager approval. Daily limit: {daily_limit:.2f}. Total today: {daily_total:.2f}"

    txn = Transaction(
        reference_number=reference,
        from_account_id=from_account_id,
        to_account_id=to_account_id,
        transaction_type="transfer",
        amount=amount,
        status="processing",
        description=description,
        initiated_by=user_id,
        processed_at=datetime.now(timezone.utc),
    )
    db.add(txn)
    db.flush()

    add_history(db, txn.transaction_id, "pending", "processing", user_id, "Transfer initiated")
    from_account.balance = float(from_account.balance) - amount
    to_account.balance = float(to_account.balance) + amount
    txn.status = "completed"
    txn.completed_at = datetime.now(timezone.utc)
    add_history(db, txn.transaction_id, "processing", "completed", user_id, "Transfer completed")
    log_audit(db, user_id, "TRANSFER", "transaction", txn.transaction_id, "Transfer processed")

    return txn, "completed", "Transfer successful"


def process_approval(db: Session, approval_id: int, approve: bool, rejection_reason: str | None, user_id: int):
    approval = db.query(PendingApproval).filter(PendingApproval.approval_id == approval_id).with_for_update().first()
    if not approval:
        return "error", "Approval request not found"
    if approval.status != "pending":
        return "error", f"Approval already {approval.status}"

    txn = db.query(Transaction).filter(Transaction.transaction_id == approval.transaction_id).with_for_update().first()
    if not txn:
        return "error", "Transaction not found"

    if not approve:
        approval.status = "rejected"
        approval.approved_by = user_id
        approval.rejection_reason = rejection_reason
        approval.processed_at = datetime.now(timezone.utc)

        txn.status = "failed"
        txn.failure_reason = f"Rejected by manager: {rejection_reason or 'No reason provided'}"
        add_history(db, txn.transaction_id, "pending", "failed", user_id, txn.failure_reason)
        log_audit(db, user_id, "REJECT_TRANSFER", "transaction", txn.transaction_id, rejection_reason)
        return "rejected", "Transfer rejected"

    from_account = lock_account(db, approval.from_account_id)
    to_account = lock_account(db, approval.to_account_id)
    if not from_account or not to_account:
        return "failed", "Account not found"
    if from_account.status != "active":
        return "failed", f"Source account is {from_account.status}"
    if to_account.status != "active":
        return "failed", f"Destination account is {to_account.status}"
    if float(approval.amount) > (available_balance(from_account) + float(from_account.overdraft_limit)):
        return "failed", "Insufficient funds"

    approval.status = "approved"
    approval.approved_by = user_id
    approval.processed_at = datetime.now(timezone.utc)

    txn.status = "processing"
    txn.approved_by = user_id
    txn.processed_at = datetime.now(timezone.utc)
    add_history(db, txn.transaction_id, "pending", "processing", user_id, "Transfer approved by manager")

    from_account.balance = float(from_account.balance) - float(approval.amount)
    to_account.balance = float(to_account.balance) + float(approval.amount)

    txn.status = "completed"
    txn.completed_at = datetime.now(timezone.utc)
    add_history(db, txn.transaction_id, "processing", "completed", user_id, "Transfer completed after approval")
    log_audit(db, user_id, "APPROVE_TRANSFER", "transaction", txn.transaction_id, "Transfer approved and completed")

    return "completed", "Transfer approved and completed successfully"
