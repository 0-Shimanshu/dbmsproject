# Banking Management System – Final Guide (DBMS Focus)

This document explains, in simple terms, how the Banking Management System uses MySQL. It lists every important SQL object and query pattern with clear examples so anyone can understand how data flows and how approvals, limits, and roles are enforced.

---

## 1) Database Overview

Main concepts:
- Users and roles: admin, manager, teller, auditor
- Accounts: balances, status, available balance
- Transactions: deposits, withdrawals, transfers, reversals
- Approvals: transfers that exceed teller limits must be approved
- Audit logs: every significant action recorded

Key tables:
- `users`
- `accounts`
- `transactions`
- `pending_approvals`
- `reversals`
- `audit_logs`

Supporting objects:
- Stored procedures: `sp_transfer`, `sp_approve_transfer`
- Triggers: keep balances and logs consistent
- Views: helpful aggregations for dashboard and reports

---

## 2) Users & Roles

Users are stored in `users`. Role controls permissions.

Example: Add a user
```sql
INSERT INTO users (username, full_name, email, role, password_hash, is_active)
VALUES ('manager1', 'Jane Manager', 'manager1@bank.local', 'manager', '<bcrypt-hash>', TRUE);
```

Example: List active managers
```sql
SELECT user_id, username, full_name
FROM users
WHERE role = 'manager' AND is_active = TRUE;
```

---

## 3) Accounts

Accounts store balances, type, status.

Example: Create an account
```sql
INSERT INTO accounts (account_number, holder_name, type, balance, available_balance, status)
VALUES ('10030001', 'Alice Smith', 'checking', 5000.00, 5000.00, 'active');
```

Example: Find active accounts
```sql
SELECT account_number, holder_name, type, balance, available_balance
FROM accounts
WHERE status = 'active';
```

Example: Freeze an account
```sql
UPDATE accounts
SET status = 'frozen'
WHERE account_number = '10030001';
```

---

## 4) Transactions

All money movements are recorded in `transactions`.
- Types: `deposit`, `withdrawal`, `transfer`, `reversal`
- Status: `pending`, `processing`, `completed`, `failed`, `reversed`, `stuck`

Example: List recent transactions
```sql
SELECT reference_number, from_account_number, to_account_number, type, amount, status, created_at
FROM transactions
ORDER BY created_at DESC
LIMIT 20;
```

Example: Check daily volume
```sql
SELECT DATE(created_at) AS day, COUNT(*) AS txn_count, SUM(amount) AS total_amount
FROM transactions
WHERE status = 'completed'
GROUP BY DATE(created_at)
ORDER BY day DESC;
```

---

## 5) Daily Transfer Limits (Teller)

Tellers have a daily transfer limit (e.g., $5,000). Exceeding the limit creates a record in `pending_approvals` and the transfer waits for manager/admin approval.

Core procedure: `sp_transfer`
- Validates account status and balances
- Enforces daily limit
- If teller exceeds limit → insert into `pending_approvals`
- Otherwise → perform transfer and insert row in `transactions`

Example: Call stored procedure to transfer funds
```sql
-- Parameters example:
-- p_from_account: 10010010
-- p_to_account:   10020014
-- p_amount:       6000.00 (exceeds teller’s limit)
-- p_requested_by: user_id of the teller
-- p_description:  'Customer requested large transfer'
CALL sp_transfer('10010010', '10020014', 6000.00, 7, 'Customer requested large transfer');
```
Result:
- A row added to `pending_approvals` with status `pending`
- No balance change until approval is processed

Check pending approvals:
```sql
SELECT *
FROM pending_approvals
WHERE status = 'pending'
ORDER BY created_at DESC;
```

---

## 6) Approvals Workflow

Managers/Admins process transfers waiting in `pending_approvals`.

Core procedure: `sp_approve_transfer`
- When approved: performs the transfer, updates balances, adds `transactions` row
- When rejected: marks approval as `rejected`, logs reason, no balance change

Example: Approve a transfer
```sql
-- Parameters:
-- p_approval_id: the ID from pending_approvals
-- p_approved_by: user_id of manager/admin
CALL sp_approve_transfer(42, 4);
```

Example: Reject a transfer
```sql
-- If the procedure supports a rejection reason, pass it, else update table:
UPDATE pending_approvals
SET status = 'rejected', rejection_reason = 'Insufficient documentation', processed_at = NOW(), approved_by = 4
WHERE approval_id = 42;
```

Example: Approval history
```sql
SELECT pa.approval_id, pa.reference_number, pa.amount, pa.status,
       pa.requested_by, pa.approved_by, pa.created_at, pa.processed_at,
       pa.rejection_reason
FROM pending_approvals AS pa
ORDER BY pa.created_at DESC;
```

---

## 7) Reversals (Last 24 Hours)

Completed transactions can be reversed within 24 hours (policy). Reversals record a new `transactions` row of type `reversal`.

Example: Find reversible transactions
```sql
SELECT t.transaction_id, t.reference_number, t.from_account_number, t.to_account_number, t.amount, t.completed_at
FROM transactions AS t
WHERE t.status = 'completed'
  AND t.completed_at >= (NOW() - INTERVAL 24 HOUR);
```

Example: Record a reversal request
```sql
INSERT INTO reversals (original_transaction_id, requested_by, reason, status)
VALUES (24, 4, 'Duplicate transfer', 'pending');
```

Example: Complete a reversal (simplified)
```sql
-- Update reversal entry
UPDATE reversals
SET status = 'completed', processed_at = NOW()
WHERE reversal_id = 12;

-- Add reversal transaction entry
INSERT INTO transactions (reference_number, from_account_number, to_account_number, type, amount, status)
SELECT CONCAT('REV-', reference_number), to_account_number, from_account_number, 'reversal', amount, 'reversed'
FROM transactions
WHERE transaction_id = 24;
```

---

## 8) Audit Logs

Every important action is logged in `audit_logs`.

Example: Record a login
```sql
INSERT INTO audit_logs (user_id, action, entity_type, entity_id, reason)
VALUES (4, 'USER_LOGIN', 'user', 4, 'User logged in');
```

Example: Query logs
```sql
SELECT created_at, user_id, action, entity_type, entity_id, reason
FROM audit_logs
ORDER BY created_at DESC
LIMIT 50;
```

---

## 9) Helpful Views (Dashboard/Reports)

Examples (your schema may include views like below):

View: `vw_daily_summary`
```sql
CREATE OR REPLACE VIEW vw_daily_summary AS
SELECT DATE(t.created_at) AS day,
       COUNT(*) AS txn_count,
       SUM(CASE WHEN t.status = 'completed' THEN t.amount ELSE 0 END) AS completed_volume,
       SUM(CASE WHEN t.status = 'failed' THEN 1 ELSE 0 END) AS failed_count
FROM transactions t
GROUP BY DATE(t.created_at);
```

Use the view:
```sql
SELECT * FROM vw_daily_summary ORDER BY day DESC LIMIT 7;
```

View: `vw_pending_approvals_count`
```sql
CREATE OR REPLACE VIEW vw_pending_approvals_count AS
SELECT COUNT(*) AS pending_approvals
FROM pending_approvals
WHERE status = 'pending';
```

Use the view:
```sql
SELECT pending_approvals FROM vw_pending_approvals_count;
```

---

## 10) Triggers (Consistency & Automation)

Typical triggers used:
- Update balances after completed transactions
- Ensure audit log entries are created

Example: After completing a transfer
```sql
CREATE TRIGGER trg_on_transfer_completed
AFTER UPDATE ON transactions
FOR EACH ROW
BEGIN
  IF NEW.type = 'transfer' AND NEW.status = 'completed' THEN
    UPDATE accounts
    SET balance = balance - NEW.amount,
        available_balance = available_balance - NEW.amount
    WHERE account_number = NEW.from_account_number;

    UPDATE accounts
    SET balance = balance + NEW.amount,
        available_balance = available_balance + NEW.amount
    WHERE account_number = NEW.to_account_number;

    INSERT INTO audit_logs (user_id, action, entity_type, entity_id, reason)
    VALUES (NEW.created_by, 'TRANSFER_COMPLETED', 'transaction', NEW.transaction_id, 'Funds moved');
  END IF;
END;
```

Note: If your schema already has triggers, they may be named differently but serve similar purposes.

---

## 11) Role-Based Access (Queries by Role)

The application enforces roles in the API middleware. From the DB perspective, you can see different queries run depending on role.

Examples:
- Teller: can create transfers; exceeding limit creates a pending approval
- Manager/Admin: can query and process `pending_approvals`
- Auditor: read-only queries (no INSERT/UPDATE)

Example queries a Manager/Admin would run:
```sql
-- See pending approvals
SELECT * FROM pending_approvals WHERE status = 'pending';

-- Approve via procedure
CALL sp_approve_transfer(approval_id := 42, p_approved_by := 4);
```

Example Teller queries:
```sql
-- Initiate a transfer; DB enforces limit inside sp_transfer
CALL sp_transfer('10010010', '10020014', 5500.00, 7, 'Customer request');
```

---

## 12) End-to-End Examples

A) Teller creates a large transfer (limit exceeded)
```sql
CALL sp_transfer('10010010', '10020014', 6000.00, 7, 'High value transfer');
```
Result:
```sql
SELECT * FROM pending_approvals WHERE status = 'pending';
```

B) Manager approves the transfer
```sql
CALL sp_approve_transfer(42, 4);
```
Result:
```sql
SELECT reference_number, status FROM transactions WHERE transaction_id = (SELECT transaction_id FROM pending_approvals WHERE approval_id = 42);
SELECT account_number, balance FROM accounts WHERE account_number IN ('10010010', '10020014');
```

C) Manager rejects another transfer
```sql
UPDATE pending_approvals
SET status = 'rejected', rejection_reason = 'Fails policy', processed_at = NOW(), approved_by = 4
WHERE approval_id = 43;
```

D) Reverse a recent transaction within 24h
```sql
INSERT INTO reversals (original_transaction_id, requested_by, reason, status)
VALUES (24, 4, 'Customer error', 'pending');

-- After approval/processing:
UPDATE reversals SET status = 'completed', processed_at = NOW() WHERE reversal_id = 12;
INSERT INTO transactions (reference_number, from_account_number, to_account_number, type, amount, status)
SELECT CONCAT('REV-', reference_number), to_account_number, from_account_number, 'reversal', amount, 'reversed'
FROM transactions WHERE transaction_id = 24;
```

---

## 13) Common Checks & Health Queries

Check stale pending approvals (> 24h)
```sql
SELECT approval_id, reference_number, created_at
FROM pending_approvals
WHERE status = 'pending' AND created_at < (NOW() - INTERVAL 24 HOUR);
```

Check stuck transactions
```sql
SELECT transaction_id, reference_number, status, created_at
FROM transactions
WHERE status = 'stuck';
```

Dashboard summary (examples)
```sql
SELECT COUNT(*) AS total_active_accounts FROM accounts WHERE status = 'active';
SELECT COUNT(*) AS pending_transactions FROM transactions WHERE status = 'pending';
SELECT COUNT(*) AS failed_today FROM transactions WHERE status = 'failed' AND DATE(created_at) = CURRENT_DATE();
SELECT COUNT(*) AS frozen_accounts FROM accounts WHERE status = 'frozen';
SELECT COUNT(*) AS completed_today FROM transactions WHERE status = 'completed' AND DATE(created_at) = CURRENT_DATE();
SELECT SUM(amount) AS total_volume_today FROM transactions WHERE status = 'completed' AND DATE(created_at) = CURRENT_DATE();
SELECT COUNT(*) AS pending_reversals FROM reversals WHERE status = 'pending';
SELECT COUNT(*) AS pending_approvals FROM pending_approvals WHERE status = 'pending';
```

---

## 14) Tips for Non-DB Experts

- Always check `status` fields before trusting amounts.
- Transfers may be pending approval; balances change only when `transactions.status = 'completed'`.
- Use the stored procedures for business rules; they prevent invalid states.
- Reversals are special transactions that undo completed transfers.
- Audit logs help you trace who did what and when.

---

## 15) Quick Reference

Tables:
- `users(user_id, username, full_name, email, role, password_hash, is_active)`
- `accounts(account_number, holder_name, type, balance, available_balance, status)`
- `transactions(transaction_id, reference_number, from_account_number, to_account_number, type, amount, status, created_at, completed_at, created_by)`
- `pending_approvals(approval_id, transaction_id, reference_number, amount, requested_by, approved_by, status, description, created_at, processed_at, rejection_reason)`
- `reversals(reversal_id, original_transaction_id, requested_by, reason, status, processed_at)`
- `audit_logs(log_id, user_id, action, entity_type, entity_id, reason, created_at)`

Procedures:
- `sp_transfer(from_acc, to_acc, amount, requested_by, description)`
- `sp_approve_transfer(approval_id, approved_by)`

Views and Triggers: As provided in your schema; examples included above.

---

This guide focuses on how the DBMS is used—what tables exist, which procedures enforce rules, and example queries for everyday tasks. Use it as your single reference to understand and operate the system’s data layer.
