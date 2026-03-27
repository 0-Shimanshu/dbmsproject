from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.deps.auth import any_authenticated
from app.schemas.common import success_response


router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/daily-stats")
def daily_stats(days: int = Query(default=30), _=Depends(any_authenticated), db: Session = Depends(get_db)):
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
                    SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END) as completed_volume,
                    AVG(CASE WHEN status = 'completed' THEN amount ELSE NULL END) as avg_transaction_amount
                FROM transactions
                WHERE created_at >= CURRENT_DATE - CAST(:days || ' days' AS INTERVAL)
                GROUP BY DATE(created_at)
                ORDER BY transaction_date ASC
                """
            ),
            {"days": max(1, min(days, 365))},
        )
        .mappings()
        .all()
    )
    return success_response(data=[dict(r) for r in rows])


@router.get("/by-type")
def by_type(_=Depends(any_authenticated), db: Session = Depends(get_db)):
    rows = (
        db.execute(
            text(
                """
                SELECT
                    transaction_type,
                    COUNT(*) as count,
                    SUM(amount) as total_amount,
                    AVG(amount) as avg_amount,
                    SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
                    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
                FROM transactions
                WHERE created_at >= NOW() - INTERVAL '30 days'
                GROUP BY transaction_type
                ORDER BY count DESC
                """
            )
        )
        .mappings()
        .all()
    )
    return success_response(data=[dict(r) for r in rows])


@router.get("/accounts")
def accounts(_=Depends(any_authenticated), db: Session = Depends(get_db)):
    summary = (
        db.execute(
            text(
                """
                SELECT
                    account_type,
                    status,
                    COUNT(*) as count,
                    SUM(balance) as total_balance,
                    AVG(balance) as avg_balance
                FROM accounts
                GROUP BY account_type, status
                ORDER BY account_type, status
                """
            )
        )
        .mappings()
        .all()
    )
    totals = (
        db.execute(
            text(
                """
                SELECT
                    COUNT(*) as total_accounts,
                    SUM(balance) as total_balance,
                    SUM(held_balance) as total_held,
                    AVG(balance) as avg_balance
                FROM accounts
                """
            )
        )
        .mappings()
        .first()
    )

    return success_response(data={"byTypeAndStatus": [dict(r) for r in summary], "totals": dict(totals) if totals else {}})


@router.get("/success-rate")
def success_rate(_=Depends(any_authenticated), db: Session = Depends(get_db)):
    rows = (
        db.execute(
            text(
                """
                SELECT
                    DATE(created_at) as date,
                    COUNT(*) as total,
                    SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as success,
                    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
                    ROUND(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as success_rate
                FROM transactions
                WHERE created_at >= NOW() - INTERVAL '30 days'
                GROUP BY DATE(created_at)
                ORDER BY date ASC
                """
            )
        )
        .mappings()
        .all()
    )
    return success_response(data=[dict(r) for r in rows])


@router.get("/hourly-volume")
def hourly(_=Depends(any_authenticated), db: Session = Depends(get_db)):
    rows = (
        db.execute(
            text(
                """
                SELECT
                    EXTRACT(HOUR FROM created_at)::INT as hour,
                    COUNT(*) as count,
                    SUM(amount) as total_amount
                FROM transactions
                WHERE DATE(created_at) = CURRENT_DATE
                GROUP BY EXTRACT(HOUR FROM created_at)
                ORDER BY hour ASC
                """
            )
        )
        .mappings()
        .all()
    )
    return success_response(data=[dict(r) for r in rows])


@router.get("/top-accounts")
def top_accounts(_=Depends(any_authenticated), db: Session = Depends(get_db)):
    rows = (
        db.execute(
            text(
                """
                SELECT
                    a.account_number,
                    CONCAT(h.first_name, ' ', h.last_name) as holder_name,
                    a.account_type,
                    a.balance,
                    COUNT(t.transaction_id) as transaction_count,
                    SUM(t.amount) as total_volume
                FROM accounts a
                JOIN account_holders h ON a.holder_id = h.holder_id
                LEFT JOIN transactions t
                    ON (a.account_id = t.from_account_id OR a.account_id = t.to_account_id)
                    AND t.created_at >= NOW() - INTERVAL '30 days'
                GROUP BY a.account_id, h.holder_id
                ORDER BY total_volume DESC NULLS LAST
                LIMIT 10
                """
            )
        )
        .mappings()
        .all()
    )
    return success_response(data=[dict(r) for r in rows])
