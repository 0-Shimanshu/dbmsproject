-- ============================================================
-- BANKING MANAGEMENT SYSTEM - POSTGRESQL SCHEMA
-- ============================================================

-- Drop in dependency-safe order
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS transaction_history CASCADE;
DROP TABLE IF EXISTS reversals CASCADE;
DROP TABLE IF EXISTS pending_approvals CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS accounts CASCADE;
DROP TABLE IF EXISTS account_holders CASCADE;
DROP TABLE IF EXISTS system_config CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ============================================================
-- CORE TABLES
-- ============================================================

CREATE TABLE users (
    user_id          SERIAL PRIMARY KEY,
    username         VARCHAR(50) NOT NULL UNIQUE,
    password_hash    VARCHAR(255) NOT NULL,
    full_name        VARCHAR(100) NOT NULL,
    email            VARCHAR(100) NOT NULL UNIQUE,
    role             VARCHAR(20) NOT NULL DEFAULT 'teller',
    is_active        BOOLEAN NOT NULL DEFAULT TRUE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_user_role CHECK (role IN ('admin', 'teller', 'manager', 'auditor'))
);

CREATE TABLE account_holders (
    holder_id        SERIAL PRIMARY KEY,
    first_name       VARCHAR(50) NOT NULL,
    last_name        VARCHAR(50) NOT NULL,
    email            VARCHAR(100) UNIQUE,
    phone            VARCHAR(20),
    address          TEXT,
    date_of_birth    DATE,
    id_number        VARCHAR(50) NOT NULL UNIQUE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE accounts (
    account_id       SERIAL PRIMARY KEY,
    account_number   VARCHAR(20) NOT NULL UNIQUE,
    holder_id        INT NOT NULL REFERENCES account_holders(holder_id),
    account_type     VARCHAR(30) NOT NULL,
    balance          NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    held_balance     NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    status           VARCHAR(20) NOT NULL DEFAULT 'active',
    freeze_reason    TEXT,
    frozen_at        TIMESTAMPTZ,
    frozen_by        INT REFERENCES users(user_id),
    interest_rate    NUMERIC(5,4) NOT NULL DEFAULT 0.0000,
    overdraft_limit  NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_account_type CHECK (account_type IN ('savings', 'checking', 'business', 'fixed_deposit')),
    CONSTRAINT chk_account_status CHECK (status IN ('active', 'frozen', 'closed', 'pending')),
    CONSTRAINT chk_account_balance CHECK (balance >= 0),
    CONSTRAINT chk_held_balance CHECK (held_balance >= 0)
);

CREATE TABLE transactions (
    transaction_id   SERIAL PRIMARY KEY,
    reference_number VARCHAR(50) NOT NULL UNIQUE,
    from_account_id  INT REFERENCES accounts(account_id),
    to_account_id    INT REFERENCES accounts(account_id),
    transaction_type VARCHAR(20) NOT NULL,
    amount           NUMERIC(15,2) NOT NULL,
    status           VARCHAR(20) NOT NULL DEFAULT 'pending',
    description      TEXT,
    initiated_by     INT REFERENCES users(user_id),
    approved_by      INT REFERENCES users(user_id),
    failure_reason   TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at     TIMESTAMPTZ,
    completed_at     TIMESTAMPTZ,
    CONSTRAINT chk_txn_type CHECK (transaction_type IN ('deposit', 'withdrawal', 'transfer', 'fee', 'interest', 'reversal')),
    CONSTRAINT chk_txn_status CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'reversed', 'stuck')),
    CONSTRAINT chk_txn_amount CHECK (amount > 0)
);

CREATE TABLE pending_approvals (
    approval_id      SERIAL PRIMARY KEY,
    transaction_id   INT NOT NULL REFERENCES transactions(transaction_id),
    from_account_id  INT NOT NULL REFERENCES accounts(account_id),
    to_account_id    INT NOT NULL REFERENCES accounts(account_id),
    amount           NUMERIC(15,2) NOT NULL,
    description      TEXT,
    requested_by     INT NOT NULL REFERENCES users(user_id),
    approved_by      INT REFERENCES users(user_id),
    status           VARCHAR(20) NOT NULL DEFAULT 'pending',
    rejection_reason TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at     TIMESTAMPTZ,
    CONSTRAINT chk_approval_status CHECK (status IN ('pending', 'approved', 'rejected')),
    CONSTRAINT chk_approval_amount CHECK (amount > 0)
);

CREATE TABLE reversals (
    reversal_id              SERIAL PRIMARY KEY,
    original_transaction_id  INT NOT NULL REFERENCES transactions(transaction_id),
    reversal_transaction_id  INT REFERENCES transactions(transaction_id),
    reason                   TEXT NOT NULL,
    status                   VARCHAR(20) NOT NULL DEFAULT 'pending',
    requested_by             INT NOT NULL REFERENCES users(user_id),
    approved_by              INT REFERENCES users(user_id),
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at             TIMESTAMPTZ,
    CONSTRAINT chk_reversal_status CHECK (status IN ('pending', 'approved', 'completed', 'rejected'))
);

CREATE TABLE transaction_history (
    history_id        SERIAL PRIMARY KEY,
    transaction_id    INT NOT NULL REFERENCES transactions(transaction_id),
    from_state        VARCHAR(30),
    to_state          VARCHAR(30) NOT NULL,
    changed_by        INT REFERENCES users(user_id),
    reason            TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE audit_logs (
    log_id            SERIAL PRIMARY KEY,
    user_id           INT REFERENCES users(user_id),
    action            VARCHAR(100) NOT NULL,
    entity_type       VARCHAR(50) NOT NULL,
    entity_id         INT,
    old_values        TEXT,
    new_values        TEXT,
    ip_address        VARCHAR(45),
    user_agent        TEXT,
    reason            TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE system_config (
    config_id         SERIAL PRIMARY KEY,
    config_key        VARCHAR(100) NOT NULL UNIQUE,
    config_value      TEXT
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_role ON users(role);

CREATE INDEX idx_holders_id_number ON account_holders(id_number);

CREATE INDEX idx_accounts_number ON accounts(account_number);
CREATE INDEX idx_accounts_status ON accounts(status);
CREATE INDEX idx_accounts_holder ON accounts(holder_id);

CREATE INDEX idx_txn_reference ON transactions(reference_number);
CREATE INDEX idx_txn_status ON transactions(status);
CREATE INDEX idx_txn_from_account ON transactions(from_account_id);
CREATE INDEX idx_txn_to_account ON transactions(to_account_id);
CREATE INDEX idx_txn_created_at ON transactions(created_at);

CREATE INDEX idx_approval_status ON pending_approvals(status);
CREATE INDEX idx_reversal_status ON reversals(status);
CREATE INDEX idx_audit_created_at ON audit_logs(created_at);

-- ============================================================
-- DEFAULT SYSTEM CONFIG
-- ============================================================

INSERT INTO system_config (config_key, config_value) VALUES
('daily_transfer_limit', '50000'),
('min_balance_savings', '100'),
('min_balance_checking', '250'),
('min_balance_business', '500')
ON CONFLICT (config_key) DO NOTHING;

-- ============================================================
-- DEFAULT USERS FOR TESTING
-- NOTE: seed users use placeholder hashes; login accepts password123 only
--       for those placeholder entries (see app/core/security.py).
-- ============================================================

INSERT INTO users (username, password_hash, full_name, email, role, is_active) VALUES
('admin', '$2b$12$placeholderhashforadmin', 'System Administrator', 'admin@bank.local', 'admin', TRUE),
('manager1', '$2b$12$placeholderhashformanager', 'Branch Manager', 'manager1@bank.local', 'manager', TRUE),
('teller1', '$2b$12$placeholderhashforteller', 'Bank Teller', 'teller1@bank.local', 'teller', TRUE),
('auditor1', '$2b$12$placeholderhashforauditor', 'System Auditor', 'auditor1@bank.local', 'auditor', TRUE)
ON CONFLICT (username) DO NOTHING;
