from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.deps.auth import any_authenticated
from app.schemas.common import success_response


router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary")
def summary(_=Depends(any_authenticated), db: Session = Depends(get_db)):
    row = (
        db.execute(
            text(
                """
                SELECT
                    (SELECT COUNT(*) FROM accounts WHERE status = 'active') as total_active_accounts,
                    (SELECT COUNT(*) FROM accounts WHERE status = 'frozen') as frozen_accounts,
                    (SELECT COUNT(*) FROM transactions WHERE status = 'pending') as pending_transactions,
                    (SELECT COUNT(*) FROM pending_approvals WHERE status = 'pending') as pending_approvals,
                    (SELECT COUNT(*) FROM transactions WHERE status = 'failed' AND DATE(created_at) = CURRENT_DATE) as failed_today,
                    (SELECT COUNT(*) FROM transactions WHERE status = 'completed' AND DATE(created_at) = CURRENT_DATE) as completed_today,
                    (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE status = 'completed' AND DATE(created_at) = CURRENT_DATE) as total_volume_today,
                    (SELECT COUNT(*) FROM transactions WHERE status = 'stuck') as stuck_transactions,
                    (SELECT COUNT(*) FROM reversals WHERE status = 'pending') as pending_reversals
                """
            )
        )
        .mappings()
        .first()
    )
    return success_response(data=dict(row) if row else {})


@router.get("/recent-activity")
def recent_activity(_=Depends(any_authenticated), db: Session = Depends(get_db)):
    rows = (
        db.execute(
            text(
                """
                SELECT
                    'transaction' as activity_type,
                    t.transaction_id as entity_id,
                    t.reference_number as reference,
                    CONCAT(t.transaction_type, ' - ', t.status) as description,
                    t.amount,
                    t.status,
                    t.created_at
                FROM transactions t
                WHERE t.created_at >= NOW() - INTERVAL '24 hours'
                UNION ALL
                SELECT
                    'account_freeze' as activity_type,
                    a.account_id as entity_id,
                    a.account_number as reference,
                    CONCAT('Account frozen: ', COALESCE(a.freeze_reason, 'No reason')) as description,
                    a.balance as amount,
                    'frozen' as status,
                    a.frozen_at as created_at
                FROM accounts a
                WHERE a.status = 'frozen' AND a.frozen_at >= NOW() - INTERVAL '24 hours'
                ORDER BY created_at DESC
                LIMIT 20
                """
            )
        )
        .mappings()
        .all()
    )
    return success_response(data=[dict(r) for r in rows])


@router.get("/transaction-stats")
def transaction_stats(_=Depends(any_authenticated), db: Session = Depends(get_db)):
    rows = (
        db.execute(
            text(
                """
                SELECT
                    DATE(created_at) as transaction_date,
                    COUNT(*) as total_transactions,
                    SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_count,
                    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_count,
                    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count,
                    SUM(CASE WHEN status = 'reversed' THEN 1 ELSE 0 END) as reversed_count,
                    SUM(CASE WHEN status = 'stuck' THEN 1 ELSE 0 END) as stuck_count,
                    SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END) as completed_volume
                FROM transactions
                GROUP BY DATE(created_at)
                ORDER BY transaction_date DESC
                LIMIT 30
                """
            )
        )
        .mappings()
        .all()
    )
    return success_response(data=[dict(r) for r in rows])


@router.get("/system-health")
def system_health(_=Depends(any_authenticated), db: Session = Depends(get_db)):
    db.execute(text("SELECT 1"))
    stuck = db.execute(text("SELECT COUNT(*) as count FROM transactions WHERE status = 'stuck' ")).mappings().first()
    stale = (
        db.execute(
            text(
                """
                SELECT COUNT(*) as count
                FROM transactions
                WHERE status = 'pending' AND created_at < NOW() - INTERVAL '5 minutes'
                """
            )
        )
        .mappings()
        .first()
    )

    stuck_count = int(stuck["count"] if stuck else 0)
    stale_count = int(stale["count"] if stale else 0)

    return success_response(
        data={
            "database": "healthy",
            "stuckTransactions": stuck_count,
            "stalePendingTransactions": stale_count,
            "overallStatus": "healthy" if stuck_count == 0 and stale_count == 0 else "warning",
            "timestamp": __import__("datetime").datetime.utcnow().isoformat(),
        }
    )
