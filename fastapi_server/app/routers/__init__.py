from app.routers import accounts, approvals, auth, dashboard, logs, reports, reversals, simulation, transactions

all_routers = [
    auth.router,
    dashboard.router,
    accounts.router,
    transactions.router,
    reversals.router,
    approvals.router,
    logs.router,
    reports.router,
    simulation.router,
]
