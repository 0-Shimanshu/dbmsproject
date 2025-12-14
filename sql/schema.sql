-- ============================================================
-- BANKING MANAGEMENT SYSTEM - DATABASE SCHEMA
-- ============================================================

DROP DATABASE IF EXISTS banking_system;
CREATE DATABASE banking_system CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE banking_system;

-- ============================================================
-- CORE TABLES
-- ============================================================

-- Users table (employees, admins, auditors)
CREATE TABLE users (
    user_id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    role ENUM('admin', 'teller', 'manager', 'auditor') NOT NULL DEFAULT 'teller',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_username (username),
    INDEX idx_role (role)
) ENGINE=InnoDB;

-- Account holders (customers)
CREATE TABLE account_holders (
    holder_id INT PRIMARY KEY AUTO_INCREMENT,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    email VARCHAR(100) UNIQUE,
    phone VARCHAR(20),
    address TEXT,
    date_of_birth DATE,
    id_number VARCHAR(50) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_id_number (id_number)
) ENGINE=InnoDB;

-- Bank accounts
CREATE TABLE accounts (
    account_id INT PRIMARY KEY AUTO_INCREMENT,
    account_number VARCHAR(20) NOT NULL UNIQUE,
    holder_id INT NOT NULL,
    account_type ENUM('savings', 'checking', 'business', 'fixed_deposit') NOT NULL DEFAULT 'savings',
    balance DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    held_balance DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    available_balance DECIMAL(15, 2) GENERATED ALWAYS AS (balance - held_balance) STORED,
    status ENUM('active', 'frozen', 'closed', 'pending') NOT NULL DEFAULT 'active',
    freeze_reason TEXT,
    frozen_at TIMESTAMP NULL,
    frozen_by INT NULL,
    interest_rate DECIMAL(5, 4) DEFAULT 0.0000,
    overdraft_limit DECIMAL(15, 2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (holder_id) REFERENCES account_holders(holder_id),
    FOREIGN KEY (frozen_by) REFERENCES users(user_id),
    INDEX idx_account_number (account_number),
    INDEX idx_status (status),
    INDEX idx_holder (holder_id),
    CONSTRAINT chk_balance CHECK (balance >= 0),
    CONSTRAINT chk_held_balance CHECK (held_balance >= 0)
) ENGINE=InnoDB;

-- Transaction lifecycle states
CREATE TABLE transaction_states (
    state_id INT PRIMARY KEY AUTO_INCREMENT,
    state_name VARCHAR(30) NOT NULL UNIQUE,
    description TEXT,
    is_terminal BOOLEAN DEFAULT FALSE
) ENGINE=InnoDB;

-- Insert transaction states
INSERT INTO transaction_states (state_name, description, is_terminal) VALUES
('pending', 'Transaction initiated, awaiting processing', FALSE),
('processing', 'Transaction is being processed', FALSE),
('completed', 'Transaction completed successfully', TRUE),
('failed', 'Transaction failed', TRUE),
('reversed', 'Transaction has been reversed', TRUE),
('stuck', 'Transaction stuck in processing', FALSE);

-- Transactions table
CREATE TABLE transactions (
    transaction_id INT PRIMARY KEY AUTO_INCREMENT,
    reference_number VARCHAR(50) NOT NULL UNIQUE,
    from_account_id INT,
    to_account_id INT,
    transaction_type ENUM('deposit', 'withdrawal', 'transfer', 'fee', 'interest', 'reversal') NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    status ENUM('pending', 'processing', 'completed', 'failed', 'reversed', 'stuck') NOT NULL DEFAULT 'pending',
    description TEXT,
    initiated_by INT,
    approved_by INT,
    failure_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    FOREIGN KEY (from_account_id) REFERENCES accounts(account_id),
    FOREIGN KEY (to_account_id) REFERENCES accounts(account_id),
    FOREIGN KEY (initiated_by) REFERENCES users(user_id),
    FOREIGN KEY (approved_by) REFERENCES users(user_id),
    INDEX idx_reference (reference_number),
    INDEX idx_status (status),
    INDEX idx_from_account (from_account_id),
    INDEX idx_to_account (to_account_id),
    INDEX idx_created_at (created_at),
    CONSTRAINT chk_amount CHECK (amount > 0)
) ENGINE=InnoDB;

-- Transaction state history (lifecycle tracking)
CREATE TABLE transaction_history (
    history_id INT PRIMARY KEY AUTO_INCREMENT,
    transaction_id INT NOT NULL,
    from_state VARCHAR(30),
    to_state VARCHAR(30) NOT NULL,
    changed_by INT,
    reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (transaction_id) REFERENCES transactions(transaction_id),
    FOREIGN KEY (changed_by) REFERENCES users(user_id),
    INDEX idx_transaction (transaction_id)
) ENGINE=InnoDB;

-- Reversals table
CREATE TABLE reversals (
    reversal_id INT PRIMARY KEY AUTO_INCREMENT,
    original_transaction_id INT NOT NULL,
    reversal_transaction_id INT,
    reason TEXT NOT NULL,
    status ENUM('pending', 'approved', 'completed', 'rejected') NOT NULL DEFAULT 'pending',
    requested_by INT NOT NULL,
    approved_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP NULL,
    FOREIGN KEY (original_transaction_id) REFERENCES transactions(transaction_id),
    FOREIGN KEY (reversal_transaction_id) REFERENCES transactions(transaction_id),
    FOREIGN KEY (requested_by) REFERENCES users(user_id),
    FOREIGN KEY (approved_by) REFERENCES users(user_id),
    INDEX idx_original_txn (original_transaction_id),
    INDEX idx_status (status)
) ENGINE=InnoDB;

-- Pending approvals for large transfers
CREATE TABLE pending_approvals (
    approval_id INT PRIMARY KEY AUTO_INCREMENT,
    transaction_id INT NOT NULL,
    from_account_id INT NOT NULL,
    to_account_id INT NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    description TEXT,
    requested_by INT NOT NULL,
    approved_by INT,
    status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
    rejection_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP NULL,
    FOREIGN KEY (transaction_id) REFERENCES transactions(transaction_id),
    FOREIGN KEY (from_account_id) REFERENCES accounts(account_id),
    FOREIGN KEY (to_account_id) REFERENCES accounts(account_id),
    FOREIGN KEY (requested_by) REFERENCES users(user_id),
    FOREIGN KEY (approved_by) REFERENCES users(user_id),
    INDEX idx_transaction (transaction_id),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB;

-- Audit logs
CREATE TABLE audit_logs (
    log_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id INT,
    old_values JSON,
    new_values JSON,
    ip_address VARCHAR(45),
    user_agent TEXT,
    reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    INDEX idx_user (user_id),
    INDEX idx_action (action),
    INDEX idx_entity (entity_type, entity_id),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB;

-- System configuration
CREATE TABLE system_config (
    config_id INT PRIMARY KEY AUTO_INCREMENT,
    config_key VARCHAR(100) NOT NULL UNIQUE,
    config_value TEXT,
    description TEXT,
    updated_by INT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (updated_by) REFERENCES users(user_id)
) ENGINE=InnoDB;

-- Insert default configuration
INSERT INTO system_config (config_key, config_value, description) VALUES
('daily_transfer_limit', '50000.00', 'Maximum daily transfer limit per account'),
('min_balance_savings', '100.00', 'Minimum balance for savings accounts'),
('min_balance_checking', '50.00', 'Minimum balance for checking accounts'),
('transaction_timeout_minutes', '5', 'Transaction processing timeout in minutes'),
('max_failed_attempts', '3', 'Maximum failed transaction attempts before hold');

-- ============================================================
-- VIEWS
-- ============================================================

-- Dashboard summary view
CREATE OR REPLACE VIEW vw_dashboard_summary AS
SELECT 
    (SELECT COUNT(*) FROM accounts WHERE status = 'active') as total_active_accounts,
    (SELECT COUNT(*) FROM accounts WHERE status = 'frozen') as frozen_accounts,
    (SELECT COUNT(*) FROM transactions WHERE status = 'pending') as pending_transactions,
    (SELECT COUNT(*) FROM pending_approvals WHERE status = 'pending') as pending_approvals,
    (SELECT COUNT(*) FROM transactions WHERE status = 'failed' AND DATE(created_at) = CURDATE()) as failed_today,
    (SELECT COUNT(*) FROM transactions WHERE status = 'completed' AND DATE(created_at) = CURDATE()) as completed_today,
    (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE status = 'completed' AND DATE(created_at) = CURDATE()) as total_volume_today,
    (SELECT COUNT(*) FROM transactions WHERE status = 'stuck') as stuck_transactions,
    (SELECT COUNT(*) FROM reversals WHERE status = 'pending') as pending_reversals;

-- Account details view
CREATE OR REPLACE VIEW vw_account_details AS
SELECT 
    a.account_id,
    a.account_number,
    CONCAT(h.first_name, ' ', h.last_name) as holder_name,
    h.email as holder_email,
    h.phone as holder_phone,
    a.account_type,
    a.balance,
    a.held_balance,
    a.available_balance,
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
LEFT JOIN users u ON a.frozen_by = u.user_id;

-- Transaction details view
CREATE OR REPLACE VIEW vw_transaction_details AS
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
LEFT JOIN users ua ON t.approved_by = ua.user_id;

-- Daily transaction statistics view
CREATE OR REPLACE VIEW vw_daily_transaction_stats AS
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
WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
GROUP BY DATE(created_at)
ORDER BY transaction_date DESC;

-- Audit log view
CREATE OR REPLACE VIEW vw_audit_logs AS
SELECT 
    al.log_id,
    u.username,
    u.full_name as actor_name,
    u.role as actor_role,
    al.action,
    al.entity_type,
    al.entity_id,
    al.old_values,
    al.new_values,
    al.reason,
    al.ip_address,
    al.created_at
FROM audit_logs al
LEFT JOIN users u ON al.user_id = u.user_id
ORDER BY al.created_at DESC;

-- Reversible transactions view
CREATE OR REPLACE VIEW vw_reversible_transactions AS
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
AND t.transaction_id NOT IN (SELECT original_transaction_id FROM reversals WHERE status IN ('pending', 'approved', 'completed'))
AND t.created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR);

-- Recent activity view
CREATE OR REPLACE VIEW vw_recent_activity AS
SELECT 
    'transaction' as activity_type,
    t.transaction_id as entity_id,
    t.reference_number as reference,
    CONCAT(t.transaction_type, ' - ', t.status) as description,
    t.amount,
    t.status,
    t.created_at
FROM transactions t
WHERE t.created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
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
WHERE a.status = 'frozen' AND a.frozen_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
ORDER BY created_at DESC
LIMIT 50;

-- ============================================================
-- STORED PROCEDURES
-- ============================================================

DELIMITER //

-- Generate unique reference number
CREATE FUNCTION fn_generate_reference()
RETURNS VARCHAR(50)
DETERMINISTIC
BEGIN
    DECLARE ref VARCHAR(50);
    SET ref = CONCAT('TXN', DATE_FORMAT(NOW(), '%Y%m%d%H%i%s'), LPAD(FLOOR(RAND() * 10000), 4, '0'));
    RETURN ref;
END //

-- Generate account number
CREATE FUNCTION fn_generate_account_number()
RETURNS VARCHAR(20)
DETERMINISTIC
BEGIN
    DECLARE acc_num VARCHAR(20);
    DECLARE exists_count INT;
    
    REPEAT
        SET acc_num = CONCAT('1001', LPAD(FLOOR(RAND() * 100000000), 8, '0'));
        SELECT COUNT(*) INTO exists_count FROM accounts WHERE account_number = acc_num;
    UNTIL exists_count = 0
    END REPEAT;
    
    RETURN acc_num;
END //

-- Create new account
CREATE PROCEDURE sp_create_account(
    IN p_holder_id INT,
    IN p_account_type VARCHAR(20),
    IN p_initial_deposit DECIMAL(15, 2),
    IN p_user_id INT,
    OUT p_account_id INT,
    OUT p_account_number VARCHAR(20),
    OUT p_status VARCHAR(20),
    OUT p_message VARCHAR(255)
)
BEGIN
    DECLARE v_min_balance DECIMAL(15, 2);
    DECLARE v_account_number VARCHAR(20);
    
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        SET p_status = 'error';
        SET p_message = 'Database error occurred';
    END;
    
    START TRANSACTION;
    
    -- Check holder exists
    IF NOT EXISTS (SELECT 1 FROM account_holders WHERE holder_id = p_holder_id) THEN
        SET p_status = 'error';
        SET p_message = 'Account holder not found';
        ROLLBACK;
    ELSE
        -- Get minimum balance requirement
        SELECT CAST(config_value AS DECIMAL(15,2)) INTO v_min_balance
        FROM system_config 
        WHERE config_key = CONCAT('min_balance_', p_account_type);
        
        IF v_min_balance IS NULL THEN
            SET v_min_balance = 0;
        END IF;
        
        IF p_initial_deposit < v_min_balance THEN
            SET p_status = 'error';
            SET p_message = CONCAT('Minimum initial deposit is ', v_min_balance);
            ROLLBACK;
        ELSE
            SET v_account_number = fn_generate_account_number();
            
            INSERT INTO accounts (account_number, holder_id, account_type, balance, status)
            VALUES (v_account_number, p_holder_id, p_account_type, p_initial_deposit, 'active');
            
            SET p_account_id = LAST_INSERT_ID();
            SET p_account_number = v_account_number;
            
            -- Log the action
            INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values, reason)
            VALUES (p_user_id, 'CREATE_ACCOUNT', 'account', p_account_id, 
                    JSON_OBJECT('account_number', v_account_number, 'type', p_account_type, 'initial_deposit', p_initial_deposit),
                    'New account created');
            
            SET p_status = 'success';
            SET p_message = 'Account created successfully';
            COMMIT;
        END IF;
    END IF;
END //

-- Process deposit
CREATE PROCEDURE sp_deposit(
    IN p_account_id INT,
    IN p_amount DECIMAL(15, 2),
    IN p_description TEXT,
    IN p_user_id INT,
    OUT p_transaction_id INT,
    OUT p_reference VARCHAR(50),
    OUT p_status VARCHAR(20),
    OUT p_message VARCHAR(255)
)
BEGIN
    DECLARE v_account_status VARCHAR(20);
    DECLARE v_reference VARCHAR(50);
    
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        SET p_status = 'failed';
        SET p_message = 'Database error during deposit';
    END;
    
    START TRANSACTION;
    
    -- Check account exists and status
    SELECT status INTO v_account_status FROM accounts WHERE account_id = p_account_id FOR UPDATE;
    
    IF v_account_status IS NULL THEN
        SET p_status = 'failed';
        SET p_message = 'Account not found';
        ROLLBACK;
    ELSEIF v_account_status != 'active' THEN
        SET p_status = 'failed';
        SET p_message = CONCAT('Account is ', v_account_status);
        ROLLBACK;
    ELSEIF p_amount <= 0 THEN
        SET p_status = 'failed';
        SET p_message = 'Amount must be greater than zero';
        ROLLBACK;
    ELSE
        SET v_reference = fn_generate_reference();
        
        -- Create transaction record
        INSERT INTO transactions (reference_number, to_account_id, transaction_type, amount, status, description, initiated_by, processed_at)
        VALUES (v_reference, p_account_id, 'deposit', p_amount, 'processing', p_description, p_user_id, NOW());
        
        SET p_transaction_id = LAST_INSERT_ID();
        SET p_reference = v_reference;
        
        -- Log state change
        INSERT INTO transaction_history (transaction_id, from_state, to_state, changed_by, reason)
        VALUES (p_transaction_id, 'pending', 'processing', p_user_id, 'Deposit initiated');
        
        -- Update balance
        UPDATE accounts SET balance = balance + p_amount WHERE account_id = p_account_id;
        
        -- Complete transaction
        UPDATE transactions SET status = 'completed', completed_at = NOW() WHERE transaction_id = p_transaction_id;
        
        -- Log state change
        INSERT INTO transaction_history (transaction_id, from_state, to_state, changed_by, reason)
        VALUES (p_transaction_id, 'processing', 'completed', p_user_id, 'Deposit completed');
        
        -- Audit log
        INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values, reason)
        VALUES (p_user_id, 'DEPOSIT', 'transaction', p_transaction_id, 
                JSON_OBJECT('amount', p_amount, 'account_id', p_account_id), 'Deposit processed');
        
        SET p_status = 'completed';
        SET p_message = 'Deposit successful';
        COMMIT;
    END IF;
END //

-- Process withdrawal
CREATE PROCEDURE sp_withdraw(
    IN p_account_id INT,
    IN p_amount DECIMAL(15, 2),
    IN p_description TEXT,
    IN p_user_id INT,
    OUT p_transaction_id INT,
    OUT p_reference VARCHAR(50),
    OUT p_status VARCHAR(20),
    OUT p_message VARCHAR(255)
)
BEGIN
    DECLARE v_account_status VARCHAR(20);
    DECLARE v_available_balance DECIMAL(15, 2);
    DECLARE v_overdraft_limit DECIMAL(15, 2);
    DECLARE v_reference VARCHAR(50);
    
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        SET p_status = 'failed';
        SET p_message = 'Database error during withdrawal';
    END;
    
    START TRANSACTION;
    
    -- Check account exists and get details
    SELECT status, available_balance, overdraft_limit 
    INTO v_account_status, v_available_balance, v_overdraft_limit 
    FROM accounts WHERE account_id = p_account_id FOR UPDATE;
    
    IF v_account_status IS NULL THEN
        SET p_status = 'failed';
        SET p_message = 'Account not found';
        ROLLBACK;
    ELSEIF v_account_status != 'active' THEN
        SET p_status = 'failed';
        SET p_message = CONCAT('Account is ', v_account_status);
        ROLLBACK;
    ELSEIF p_amount <= 0 THEN
        SET p_status = 'failed';
        SET p_message = 'Amount must be greater than zero';
        ROLLBACK;
    ELSEIF p_amount > (v_available_balance + v_overdraft_limit) THEN
        SET v_reference = fn_generate_reference();
        
        -- Create failed transaction record
        INSERT INTO transactions (reference_number, from_account_id, transaction_type, amount, status, description, initiated_by, failure_reason)
        VALUES (v_reference, p_account_id, 'withdrawal', p_amount, 'failed', p_description, p_user_id, 'Insufficient funds');
        
        SET p_transaction_id = LAST_INSERT_ID();
        SET p_reference = v_reference;
        SET p_status = 'failed';
        SET p_message = 'Insufficient funds';
        COMMIT;
    ELSE
        SET v_reference = fn_generate_reference();
        
        -- Create transaction record
        INSERT INTO transactions (reference_number, from_account_id, transaction_type, amount, status, description, initiated_by, processed_at)
        VALUES (v_reference, p_account_id, 'withdrawal', p_amount, 'processing', p_description, p_user_id, NOW());
        
        SET p_transaction_id = LAST_INSERT_ID();
        SET p_reference = v_reference;
        
        -- Log state change
        INSERT INTO transaction_history (transaction_id, from_state, to_state, changed_by, reason)
        VALUES (p_transaction_id, 'pending', 'processing', p_user_id, 'Withdrawal initiated');
        
        -- Update balance
        UPDATE accounts SET balance = balance - p_amount WHERE account_id = p_account_id;
        
        -- Complete transaction
        UPDATE transactions SET status = 'completed', completed_at = NOW() WHERE transaction_id = p_transaction_id;
        
        -- Log state change
        INSERT INTO transaction_history (transaction_id, from_state, to_state, changed_by, reason)
        VALUES (p_transaction_id, 'processing', 'completed', p_user_id, 'Withdrawal completed');
        
        -- Audit log
        INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values, reason)
        VALUES (p_user_id, 'WITHDRAWAL', 'transaction', p_transaction_id, 
                JSON_OBJECT('amount', p_amount, 'account_id', p_account_id), 'Withdrawal processed');
        
        SET p_status = 'completed';
        SET p_message = 'Withdrawal successful';
        COMMIT;
    END IF;
END //

-- Process transfer
CREATE PROCEDURE sp_transfer(
    IN p_from_account_id INT,
    IN p_to_account_id INT,
    IN p_amount DECIMAL(15, 2),
    IN p_description TEXT,
    IN p_user_id INT,
    OUT p_transaction_id INT,
    OUT p_reference VARCHAR(50),
    OUT p_status VARCHAR(20),
    OUT p_message VARCHAR(255)
)
BEGIN
    DECLARE v_from_status VARCHAR(20);
    DECLARE v_to_status VARCHAR(20);
    DECLARE v_available_balance DECIMAL(15, 2);
    DECLARE v_overdraft_limit DECIMAL(15, 2);
    DECLARE v_reference VARCHAR(50);
    DECLARE v_daily_limit DECIMAL(15, 2);
    DECLARE v_daily_total DECIMAL(15, 2);
    DECLARE v_user_role VARCHAR(20);
    
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        -- Release held balance on error
        UPDATE accounts SET held_balance = held_balance - p_amount 
        WHERE account_id = p_from_account_id AND held_balance >= p_amount;
        SET p_status = 'failed';
        SET p_message = 'Database error during transfer';
    END;
    
    START TRANSACTION;
    
    -- Get daily transfer limit from system config
    SELECT CAST(config_value AS DECIMAL(15, 2)) INTO v_daily_limit 
    FROM system_config WHERE config_key = 'daily_transfer_limit';
    
    -- Get user role
    SELECT role INTO v_user_role FROM users WHERE user_id = p_user_id;
    
    -- Calculate today's total transfers from this account
    SELECT COALESCE(SUM(amount), 0) INTO v_daily_total
    FROM transactions 
    WHERE from_account_id = p_from_account_id 
    AND transaction_type = 'transfer' 
    AND status = 'completed'
    AND DATE(created_at) = CURDATE();
    
    -- Validate accounts
    IF p_from_account_id = p_to_account_id THEN
        SET p_status = 'failed';
        SET p_message = 'Cannot transfer to the same account';
        ROLLBACK;
    ELSE
        -- Get from account details
        SELECT status, available_balance, overdraft_limit 
        INTO v_from_status, v_available_balance, v_overdraft_limit 
        FROM accounts WHERE account_id = p_from_account_id FOR UPDATE;
        
        -- Get to account status
        SELECT status INTO v_to_status FROM accounts WHERE account_id = p_to_account_id FOR UPDATE;
        
        IF v_from_status IS NULL THEN
            SET p_status = 'failed';
            SET p_message = 'Source account not found';
            ROLLBACK;
        ELSEIF v_to_status IS NULL THEN
            SET p_status = 'failed';
            SET p_message = 'Destination account not found';
            ROLLBACK;
        ELSEIF v_from_status != 'active' THEN
            SET p_status = 'failed';
            SET p_message = CONCAT('Source account is ', v_from_status);
            ROLLBACK;
        ELSEIF v_to_status != 'active' THEN
            SET p_status = 'failed';
            SET p_message = CONCAT('Destination account is ', v_to_status);
            ROLLBACK;
        ELSEIF p_amount <= 0 THEN
            SET p_status = 'failed';
            SET p_message = 'Amount must be greater than zero';
            ROLLBACK;
        ELSEIF p_amount > (v_available_balance + v_overdraft_limit) THEN
            SET v_reference = fn_generate_reference();
            
            -- Create failed transaction record
            INSERT INTO transactions (reference_number, from_account_id, to_account_id, transaction_type, amount, status, description, initiated_by, failure_reason)
            VALUES (v_reference, p_from_account_id, p_to_account_id, 'transfer', p_amount, 'failed', p_description, p_user_id, 'Insufficient funds');
            
            SET p_transaction_id = LAST_INSERT_ID();
            SET p_reference = v_reference;
            SET p_status = 'failed';
            SET p_message = 'Insufficient funds';
            COMMIT;
        -- Check daily limit (only for tellers; managers and admins can override)
        ELSEIF (v_daily_total + p_amount) > v_daily_limit AND v_user_role = 'teller' THEN
            SET v_reference = fn_generate_reference();
            
            -- Create pending transaction record
            INSERT INTO transactions (reference_number, from_account_id, to_account_id, transaction_type, amount, status, description, initiated_by)
            VALUES (v_reference, p_from_account_id, p_to_account_id, 'transfer', p_amount, 'pending', p_description, p_user_id);
            
            SET p_transaction_id = LAST_INSERT_ID();
            SET p_reference = v_reference;
            
            -- Create pending approval record
            INSERT INTO pending_approvals (transaction_id, from_account_id, to_account_id, amount, description, requested_by)
            VALUES (p_transaction_id, p_from_account_id, p_to_account_id, p_amount, p_description, p_user_id);
            
            -- Log state change
            INSERT INTO transaction_history (transaction_id, from_state, to_state, changed_by, reason)
            VALUES (p_transaction_id, NULL, 'pending', p_user_id, 
                    CONCAT('Transfer exceeds daily limit (', FORMAT(v_daily_limit, 2), '). Total today: ', FORMAT(v_daily_total, 2), '. Requires manager approval.'));
            
            -- Audit log
            INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values, reason)
            VALUES (p_user_id, 'TRANSFER_REQUEST', 'transaction', p_transaction_id, 
                    JSON_OBJECT('amount', p_amount, 'from_account', p_from_account_id, 'to_account', p_to_account_id, 'daily_total', v_daily_total, 'daily_limit', v_daily_limit), 
                    'Transfer requires approval due to daily limit');
            
            SET p_status = 'pending';
            SET p_message = CONCAT('Transfer requires manager approval. Daily limit: ', FORMAT(v_daily_limit, 2), '. Total today: ', FORMAT(v_daily_total, 2));
            COMMIT;
        ELSE
            SET v_reference = fn_generate_reference();
            
            -- Hold the amount first
            UPDATE accounts SET held_balance = held_balance + p_amount WHERE account_id = p_from_account_id;
            
            -- Create transaction record
            INSERT INTO transactions (reference_number, from_account_id, to_account_id, transaction_type, amount, status, description, initiated_by, processed_at)
            VALUES (v_reference, p_from_account_id, p_to_account_id, 'transfer', p_amount, 'processing', p_description, p_user_id, NOW());
            
            SET p_transaction_id = LAST_INSERT_ID();
            SET p_reference = v_reference;
            
            -- Log state change
            INSERT INTO transaction_history (transaction_id, from_state, to_state, changed_by, reason)
            VALUES (p_transaction_id, 'pending', 'processing', p_user_id, 'Transfer initiated');
            
            -- Debit from account
            UPDATE accounts SET balance = balance - p_amount, held_balance = held_balance - p_amount WHERE account_id = p_from_account_id;
            
            -- Credit to account
            UPDATE accounts SET balance = balance + p_amount WHERE account_id = p_to_account_id;
            
            -- Complete transaction
            UPDATE transactions SET status = 'completed', completed_at = NOW() WHERE transaction_id = p_transaction_id;
            
            -- Log state change
            INSERT INTO transaction_history (transaction_id, from_state, to_state, changed_by, reason)
            VALUES (p_transaction_id, 'processing', 'completed', p_user_id, 'Transfer completed');
            
            -- Audit log
            INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values, reason)
            VALUES (p_user_id, 'TRANSFER', 'transaction', p_transaction_id, 
                    JSON_OBJECT('amount', p_amount, 'from_account', p_from_account_id, 'to_account', p_to_account_id), 'Transfer processed');
            
            SET p_status = 'completed';
            SET p_message = 'Transfer successful';
            COMMIT;
        END IF;
    END IF;
END //

-- Approve or reject pending transfer
CREATE PROCEDURE sp_approve_transfer(
    IN p_approval_id INT,
    IN p_user_id INT,
    IN p_approve BOOLEAN, -- TRUE to approve, FALSE to reject
    IN p_rejection_reason TEXT,
    OUT p_status VARCHAR(20),
    OUT p_message VARCHAR(255)
)
BEGIN
    DECLARE v_transaction_id INT;
    DECLARE v_from_account_id INT;
    DECLARE v_to_account_id INT;
    DECLARE v_amount DECIMAL(15, 2);
    DECLARE v_description TEXT;
    DECLARE v_approval_status VARCHAR(20);
    DECLARE v_user_role VARCHAR(20);
    DECLARE v_available_balance DECIMAL(15, 2);
    DECLARE v_overdraft_limit DECIMAL(15, 2);
    DECLARE v_from_status VARCHAR(20);
    DECLARE v_to_status VARCHAR(20);
    
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        -- Release held balance on error
        UPDATE accounts SET held_balance = held_balance - v_amount 
        WHERE account_id = v_from_account_id AND held_balance >= v_amount;
        SET p_status = 'failed';
        SET p_message = 'Database error during approval';
    END;
    
    START TRANSACTION;
    
    -- Get user role
    SELECT role INTO v_user_role FROM users WHERE user_id = p_user_id;
    
    -- Check if user has permission (must be manager or admin)
    IF v_user_role NOT IN ('manager', 'admin') THEN
        SET p_status = 'error';
        SET p_message = 'Only managers and admins can approve transfers';
        ROLLBACK;
    ELSE
        -- Get approval details
        SELECT transaction_id, from_account_id, to_account_id, amount, description, status
        INTO v_transaction_id, v_from_account_id, v_to_account_id, v_amount, v_description, v_approval_status
        FROM pending_approvals 
        WHERE approval_id = p_approval_id FOR UPDATE;
        
        IF v_transaction_id IS NULL THEN
            SET p_status = 'error';
            SET p_message = 'Approval request not found';
            ROLLBACK;
        ELSEIF v_approval_status != 'pending' THEN
            SET p_status = 'error';
            SET p_message = CONCAT('Approval already ', v_approval_status);
            ROLLBACK;
        ELSEIF p_approve = FALSE THEN
            -- Reject the transfer
            UPDATE pending_approvals 
            SET status = 'rejected', approved_by = p_user_id, rejection_reason = p_rejection_reason, processed_at = NOW()
            WHERE approval_id = p_approval_id;
            
            UPDATE transactions 
            SET status = 'failed', failure_reason = CONCAT('Rejected by manager: ', p_rejection_reason)
            WHERE transaction_id = v_transaction_id;
            
            -- Log state change
            INSERT INTO transaction_history (transaction_id, from_state, to_state, changed_by, reason)
            VALUES (v_transaction_id, 'pending', 'failed', p_user_id, CONCAT('Transfer rejected: ', p_rejection_reason));
            
            -- Audit log
            INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values, reason)
            VALUES (p_user_id, 'REJECT_TRANSFER', 'transaction', v_transaction_id, 
                    JSON_OBJECT('approval_id', p_approval_id, 'amount', v_amount), p_rejection_reason);
            
            SET p_status = 'rejected';
            SET p_message = 'Transfer rejected';
            COMMIT;
        ELSE
            -- Approve and process the transfer
            -- Get account details for validation
            SELECT status, available_balance, overdraft_limit 
            INTO v_from_status, v_available_balance, v_overdraft_limit 
            FROM accounts WHERE account_id = v_from_account_id FOR UPDATE;
            
            SELECT status INTO v_to_status FROM accounts WHERE account_id = v_to_account_id FOR UPDATE;
            
            -- Validate accounts are still valid
            IF v_from_status != 'active' THEN
                SET p_status = 'failed';
                SET p_message = CONCAT('Source account is ', v_from_status);
                
                UPDATE pending_approvals 
                SET status = 'rejected', approved_by = p_user_id, rejection_reason = p_message, processed_at = NOW()
                WHERE approval_id = p_approval_id;
                
                UPDATE transactions SET status = 'failed', failure_reason = p_message WHERE transaction_id = v_transaction_id;
                COMMIT;
            ELSEIF v_to_status != 'active' THEN
                SET p_status = 'failed';
                SET p_message = CONCAT('Destination account is ', v_to_status);
                
                UPDATE pending_approvals 
                SET status = 'rejected', approved_by = p_user_id, rejection_reason = p_message, processed_at = NOW()
                WHERE approval_id = p_approval_id;
                
                UPDATE transactions SET status = 'failed', failure_reason = p_message WHERE transaction_id = v_transaction_id;
                COMMIT;
            ELSEIF v_amount > (v_available_balance + v_overdraft_limit) THEN
                SET p_status = 'failed';
                SET p_message = 'Insufficient funds';
                
                UPDATE pending_approvals 
                SET status = 'rejected', approved_by = p_user_id, rejection_reason = p_message, processed_at = NOW()
                WHERE approval_id = p_approval_id;
                
                UPDATE transactions SET status = 'failed', failure_reason = p_message WHERE transaction_id = v_transaction_id;
                COMMIT;
            ELSE
                -- Update approval record
                UPDATE pending_approvals 
                SET status = 'approved', approved_by = p_user_id, processed_at = NOW()
                WHERE approval_id = p_approval_id;
                
                -- Hold the amount
                UPDATE accounts SET held_balance = held_balance + v_amount WHERE account_id = v_from_account_id;
                
                -- Update transaction to processing
                UPDATE transactions 
                SET status = 'processing', approved_by = p_user_id, processed_at = NOW()
                WHERE transaction_id = v_transaction_id;
                
                -- Log state change
                INSERT INTO transaction_history (transaction_id, from_state, to_state, changed_by, reason)
                VALUES (v_transaction_id, 'pending', 'processing', p_user_id, 'Transfer approved by manager');
                
                -- Debit from account
                UPDATE accounts SET balance = balance - v_amount, held_balance = held_balance - v_amount 
                WHERE account_id = v_from_account_id;
                
                -- Credit to account
                UPDATE accounts SET balance = balance + v_amount WHERE account_id = v_to_account_id;
                
                -- Complete transaction
                UPDATE transactions SET status = 'completed', completed_at = NOW() WHERE transaction_id = v_transaction_id;
                
                -- Log state change
                INSERT INTO transaction_history (transaction_id, from_state, to_state, changed_by, reason)
                VALUES (v_transaction_id, 'processing', 'completed', p_user_id, 'Transfer completed after approval');
                
                -- Audit log
                INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values, reason)
                VALUES (p_user_id, 'APPROVE_TRANSFER', 'transaction', v_transaction_id, 
                        JSON_OBJECT('approval_id', p_approval_id, 'amount', v_amount, 'from_account', v_from_account_id, 'to_account', v_to_account_id), 
                        'Transfer approved and completed');
                
                SET p_status = 'completed';
                SET p_message = 'Transfer approved and completed successfully';
                COMMIT;
            END IF;
        END IF;
    END IF;
END //

-- Freeze account
CREATE PROCEDURE sp_freeze_account(
    IN p_account_id INT,
    IN p_reason TEXT,
    IN p_user_id INT,
    OUT p_status VARCHAR(20),
    OUT p_message VARCHAR(255)
)
BEGIN
    DECLARE v_current_status VARCHAR(20);
    DECLARE v_account_number VARCHAR(20);
    
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        SET p_status = 'error';
        SET p_message = 'Database error occurred';
    END;
    
    START TRANSACTION;
    
    SELECT status, account_number INTO v_current_status, v_account_number 
    FROM accounts WHERE account_id = p_account_id FOR UPDATE;
    
    IF v_current_status IS NULL THEN
        SET p_status = 'error';
        SET p_message = 'Account not found';
        ROLLBACK;
    ELSEIF v_current_status = 'frozen' THEN
        SET p_status = 'error';
        SET p_message = 'Account is already frozen';
        ROLLBACK;
    ELSEIF v_current_status = 'closed' THEN
        SET p_status = 'error';
        SET p_message = 'Cannot freeze a closed account';
        ROLLBACK;
    ELSE
        UPDATE accounts 
        SET status = 'frozen', freeze_reason = p_reason, frozen_at = NOW(), frozen_by = p_user_id
        WHERE account_id = p_account_id;
        
        -- Audit log
        INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_values, new_values, reason)
        VALUES (p_user_id, 'FREEZE_ACCOUNT', 'account', p_account_id, 
                JSON_OBJECT('status', v_current_status),
                JSON_OBJECT('status', 'frozen', 'frozen_at', NOW()),
                p_reason);
        
        SET p_status = 'success';
        SET p_message = CONCAT('Account ', v_account_number, ' frozen successfully');
        COMMIT;
    END IF;
END //

-- Unfreeze account
CREATE PROCEDURE sp_unfreeze_account(
    IN p_account_id INT,
    IN p_reason TEXT,
    IN p_user_id INT,
    OUT p_status VARCHAR(20),
    OUT p_message VARCHAR(255)
)
BEGIN
    DECLARE v_current_status VARCHAR(20);
    DECLARE v_account_number VARCHAR(20);
    
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        SET p_status = 'error';
        SET p_message = 'Database error occurred';
    END;
    
    START TRANSACTION;
    
    SELECT status, account_number INTO v_current_status, v_account_number 
    FROM accounts WHERE account_id = p_account_id FOR UPDATE;
    
    IF v_current_status IS NULL THEN
        SET p_status = 'error';
        SET p_message = 'Account not found';
        ROLLBACK;
    ELSEIF v_current_status != 'frozen' THEN
        SET p_status = 'error';
        SET p_message = 'Account is not frozen';
        ROLLBACK;
    ELSE
        UPDATE accounts 
        SET status = 'active', freeze_reason = NULL, frozen_at = NULL, frozen_by = NULL
        WHERE account_id = p_account_id;
        
        -- Audit log
        INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_values, new_values, reason)
        VALUES (p_user_id, 'UNFREEZE_ACCOUNT', 'account', p_account_id, 
                JSON_OBJECT('status', 'frozen'),
                JSON_OBJECT('status', 'active'),
                p_reason);
        
        SET p_status = 'success';
        SET p_message = CONCAT('Account ', v_account_number, ' unfrozen successfully');
        COMMIT;
    END IF;
END //

-- Process reversal
CREATE PROCEDURE sp_reverse_transaction(
    IN p_transaction_id INT,
    IN p_reason TEXT,
    IN p_user_id INT,
    OUT p_reversal_id INT,
    OUT p_status VARCHAR(20),
    OUT p_message VARCHAR(255)
)
BEGIN
    DECLARE v_txn_status VARCHAR(20);
    DECLARE v_txn_type VARCHAR(20);
    DECLARE v_amount DECIMAL(15, 2);
    DECLARE v_from_account INT;
    DECLARE v_to_account INT;
    DECLARE v_reversal_ref VARCHAR(50);
    DECLARE v_reversal_txn_id INT;
    
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        SET p_status = 'failed';
        SET p_message = 'Database error during reversal';
    END;
    
    START TRANSACTION;
    
    -- Check if already reversed
    IF EXISTS (SELECT 1 FROM reversals WHERE original_transaction_id = p_transaction_id AND status IN ('pending', 'approved', 'completed')) THEN
        SET p_status = 'failed';
        SET p_message = 'Transaction already has a reversal request';
        ROLLBACK;
    ELSE
        -- Get transaction details
        SELECT status, transaction_type, amount, from_account_id, to_account_id
        INTO v_txn_status, v_txn_type, v_amount, v_from_account, v_to_account
        FROM transactions WHERE transaction_id = p_transaction_id FOR UPDATE;
        
        IF v_txn_status IS NULL THEN
            SET p_status = 'failed';
            SET p_message = 'Transaction not found';
            ROLLBACK;
        ELSEIF v_txn_status != 'completed' THEN
            SET p_status = 'failed';
            SET p_message = 'Only completed transactions can be reversed';
            ROLLBACK;
        ELSE
            SET v_reversal_ref = fn_generate_reference();
            
            -- Create reversal transaction
            INSERT INTO transactions (reference_number, from_account_id, to_account_id, transaction_type, amount, status, description, initiated_by, processed_at)
            VALUES (v_reversal_ref, v_to_account, v_from_account, 'reversal', v_amount, 'processing', CONCAT('Reversal of transaction ', p_transaction_id), p_user_id, NOW());
            
            SET v_reversal_txn_id = LAST_INSERT_ID();
            
            -- Reverse the money movement based on transaction type
            IF v_txn_type = 'transfer' THEN
                -- Reverse transfer: credit from_account, debit to_account
                UPDATE accounts SET balance = balance + v_amount WHERE account_id = v_from_account;
                UPDATE accounts SET balance = balance - v_amount WHERE account_id = v_to_account;
            ELSEIF v_txn_type = 'deposit' THEN
                -- Reverse deposit: debit to_account
                UPDATE accounts SET balance = balance - v_amount WHERE account_id = v_to_account;
            ELSEIF v_txn_type = 'withdrawal' THEN
                -- Reverse withdrawal: credit from_account
                UPDATE accounts SET balance = balance + v_amount WHERE account_id = v_from_account;
            END IF;
            
            -- Update original transaction status
            UPDATE transactions SET status = 'reversed' WHERE transaction_id = p_transaction_id;
            
            -- Complete reversal transaction
            UPDATE transactions SET status = 'completed', completed_at = NOW() WHERE transaction_id = v_reversal_txn_id;
            
            -- Create reversal record
            INSERT INTO reversals (original_transaction_id, reversal_transaction_id, reason, status, requested_by, approved_by, processed_at)
            VALUES (p_transaction_id, v_reversal_txn_id, p_reason, 'completed', p_user_id, p_user_id, NOW());
            
            SET p_reversal_id = LAST_INSERT_ID();
            
            -- Log state changes
            INSERT INTO transaction_history (transaction_id, from_state, to_state, changed_by, reason)
            VALUES (p_transaction_id, 'completed', 'reversed', p_user_id, p_reason);
            
            -- Audit log
            INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values, reason)
            VALUES (p_user_id, 'REVERSE_TRANSACTION', 'transaction', p_transaction_id, 
                    JSON_OBJECT('reversal_id', p_reversal_id, 'amount', v_amount), p_reason);
            
            SET p_status = 'completed';
            SET p_message = 'Transaction reversed successfully';
            COMMIT;
        END IF;
    END IF;
END //

-- Simulate stuck transaction
CREATE PROCEDURE sp_simulate_stuck_transaction(
    IN p_from_account_id INT,
    IN p_to_account_id INT,
    IN p_amount DECIMAL(15, 2),
    IN p_user_id INT,
    OUT p_transaction_id INT,
    OUT p_reference VARCHAR(50),
    OUT p_status VARCHAR(20),
    OUT p_message VARCHAR(255)
)
BEGIN
    DECLARE v_reference VARCHAR(50);
    
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        SET p_status = 'error';
        SET p_message = 'Database error occurred';
    END;
    
    START TRANSACTION;
    
    SET v_reference = fn_generate_reference();
    
    -- Hold the amount
    UPDATE accounts SET held_balance = held_balance + p_amount WHERE account_id = p_from_account_id;
    
    -- Create stuck transaction
    INSERT INTO transactions (reference_number, from_account_id, to_account_id, transaction_type, amount, status, description, initiated_by, processed_at)
    VALUES (v_reference, p_from_account_id, p_to_account_id, 'transfer', p_amount, 'stuck', 'Simulated stuck transaction', p_user_id, NOW());
    
    SET p_transaction_id = LAST_INSERT_ID();
    SET p_reference = v_reference;
    
    -- Log state changes
    INSERT INTO transaction_history (transaction_id, from_state, to_state, changed_by, reason)
    VALUES (p_transaction_id, 'pending', 'processing', p_user_id, 'Transaction started');
    
    INSERT INTO transaction_history (transaction_id, from_state, to_state, changed_by, reason)
    VALUES (p_transaction_id, 'processing', 'stuck', p_user_id, 'Simulated timeout - transaction stuck');
    
    -- Audit log
    INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values, reason)
    VALUES (p_user_id, 'SIMULATE_STUCK', 'transaction', p_transaction_id, 
            JSON_OBJECT('amount', p_amount), 'Stuck transaction simulation');
    
    SET p_status = 'stuck';
    SET p_message = 'Stuck transaction simulated successfully';
    COMMIT;
END //

-- Recover stuck transaction
CREATE PROCEDURE sp_recover_stuck_transaction(
    IN p_transaction_id INT,
    IN p_action VARCHAR(20),
    IN p_user_id INT,
    OUT p_status VARCHAR(20),
    OUT p_message VARCHAR(255)
)
BEGIN
    DECLARE v_txn_status VARCHAR(20);
    DECLARE v_amount DECIMAL(15, 2);
    DECLARE v_from_account INT;
    DECLARE v_to_account INT;
    
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        SET p_status = 'error';
        SET p_message = 'Database error occurred';
    END;
    
    START TRANSACTION;
    
    SELECT status, amount, from_account_id, to_account_id
    INTO v_txn_status, v_amount, v_from_account, v_to_account
    FROM transactions WHERE transaction_id = p_transaction_id FOR UPDATE;
    
    IF v_txn_status IS NULL THEN
        SET p_status = 'error';
        SET p_message = 'Transaction not found';
        ROLLBACK;
    ELSEIF v_txn_status != 'stuck' THEN
        SET p_status = 'error';
        SET p_message = 'Transaction is not stuck';
        ROLLBACK;
    ELSE
        IF p_action = 'complete' THEN
            -- Complete the transfer
            UPDATE accounts SET balance = balance - v_amount, held_balance = held_balance - v_amount WHERE account_id = v_from_account;
            UPDATE accounts SET balance = balance + v_amount WHERE account_id = v_to_account;
            UPDATE transactions SET status = 'completed', completed_at = NOW() WHERE transaction_id = p_transaction_id;
            
            INSERT INTO transaction_history (transaction_id, from_state, to_state, changed_by, reason)
            VALUES (p_transaction_id, 'stuck', 'completed', p_user_id, 'Manually completed by admin');
            
            SET p_status = 'completed';
            SET p_message = 'Transaction completed successfully';
        ELSEIF p_action = 'fail' THEN
            -- Release held balance and fail
            UPDATE accounts SET held_balance = held_balance - v_amount WHERE account_id = v_from_account;
            UPDATE transactions SET status = 'failed', failure_reason = 'Manually failed by admin' WHERE transaction_id = p_transaction_id;
            
            INSERT INTO transaction_history (transaction_id, from_state, to_state, changed_by, reason)
            VALUES (p_transaction_id, 'stuck', 'failed', p_user_id, 'Manually failed by admin');
            
            SET p_status = 'failed';
            SET p_message = 'Transaction failed and funds released';
        ELSE
            SET p_status = 'error';
            SET p_message = 'Invalid action. Use complete or fail';
            ROLLBACK;
        END IF;
        
        IF p_status != 'error' THEN
            INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values, reason)
            VALUES (p_user_id, 'RECOVER_STUCK', 'transaction', p_transaction_id, 
                    JSON_OBJECT('action', p_action), 'Stuck transaction recovered');
            COMMIT;
        END IF;
    END IF;
END //

DELIMITER ;

-- ============================================================
-- TRIGGERS
-- ============================================================

DELIMITER //

-- Trigger to log account balance changes
CREATE TRIGGER trg_account_balance_update
AFTER UPDATE ON accounts
FOR EACH ROW
BEGIN
    IF OLD.balance != NEW.balance THEN
        INSERT INTO audit_logs (action, entity_type, entity_id, old_values, new_values, reason)
        VALUES ('BALANCE_CHANGE', 'account', NEW.account_id,
                JSON_OBJECT('balance', OLD.balance, 'held_balance', OLD.held_balance),
                JSON_OBJECT('balance', NEW.balance, 'held_balance', NEW.held_balance),
                'Balance updated');
    END IF;
END //

-- Trigger to log transaction state changes
CREATE TRIGGER trg_transaction_status_update
AFTER UPDATE ON transactions
FOR EACH ROW
BEGIN
    IF OLD.status != NEW.status THEN
        INSERT INTO audit_logs (action, entity_type, entity_id, old_values, new_values, reason)
        VALUES ('TRANSACTION_STATUS_CHANGE', 'transaction', NEW.transaction_id,
                JSON_OBJECT('status', OLD.status),
                JSON_OBJECT('status', NEW.status),
                CONCAT('Status changed from ', OLD.status, ' to ', NEW.status));
    END IF;
END //

DELIMITER ;

-- ============================================================
-- SEED DATA
-- ============================================================

-- Insert users (password is 'password123' hashed with bcrypt)
INSERT INTO users (username, password_hash, full_name, email, role) VALUES
('admin', '$2b$10$rQZ5X5z5z5z5z5z5z5z5zO5z5z5z5z5z5z5z5z5z5z5z5z5z5z5z5', 'System Administrator', 'admin@bank.com', 'admin'),
('teller1', '$2b$10$rQZ5X5z5z5z5z5z5z5z5zO5z5z5z5z5z5z5z5z5z5z5z5z5z5z5z5', 'John Smith', 'john.smith@bank.com', 'teller'),
('teller2', '$2b$10$rQZ5X5z5z5z5z5z5z5z5zO5z5z5z5z5z5z5z5z5z5z5z5z5z5z5z5', 'Jane Doe', 'jane.doe@bank.com', 'teller'),
('manager1', '$2b$10$rQZ5X5z5z5z5z5z5z5z5zO5z5z5z5z5z5z5z5z5z5z5z5z5z5z5z5', 'Robert Johnson', 'robert.johnson@bank.com', 'manager'),
('auditor1', '$2b$10$rQZ5X5z5z5z5z5z5z5z5zO5z5z5z5z5z5z5z5z5z5z5z5z5z5z5z5', 'Emily Brown', 'emily.brown@bank.com', 'auditor');

-- Insert account holders
INSERT INTO account_holders (first_name, last_name, email, phone, address, date_of_birth, id_number) VALUES
('Michael', 'Williams', 'michael.w@email.com', '555-0101', '123 Main St, City', '1985-03-15', 'ID001'),
('Sarah', 'Johnson', 'sarah.j@email.com', '555-0102', '456 Oak Ave, Town', '1990-07-22', 'ID002'),
('David', 'Brown', 'david.b@email.com', '555-0103', '789 Pine Rd, Village', '1978-11-08', 'ID003'),
('Jennifer', 'Davis', 'jennifer.d@email.com', '555-0104', '321 Elm St, City', '1982-05-30', 'ID004'),
('James', 'Miller', 'james.m@email.com', '555-0105', '654 Maple Dr, Town', '1995-01-12', 'ID005'),
('Lisa', 'Wilson', 'lisa.w@email.com', '555-0106', '987 Cedar Ln, Village', '1988-09-25', 'ID006'),
('Robert', 'Moore', 'robert.m@email.com', '555-0107', '147 Birch Blvd, City', '1975-12-03', 'ID007'),
('Amanda', 'Taylor', 'amanda.t@email.com', '555-0108', '258 Spruce Way, Town', '1992-04-18', 'ID008');

-- Insert accounts
INSERT INTO accounts (account_number, holder_id, account_type, balance, status, interest_rate) VALUES
('10010001', 1, 'savings', 15000.00, 'active', 0.0250),
('10010002', 1, 'checking', 5000.00, 'active', 0.0050),
('10010003', 2, 'savings', 25000.00, 'active', 0.0250),
('10010004', 3, 'business', 75000.00, 'active', 0.0150),
('10010005', 4, 'checking', 3500.00, 'active', 0.0050),
('10010006', 5, 'savings', 8000.00, 'active', 0.0250),
('10010007', 6, 'fixed_deposit', 50000.00, 'active', 0.0450),
('10010008', 7, 'checking', 12000.00, 'frozen', 0.0050),
('10010009', 8, 'savings', 20000.00, 'active', 0.0250),
('10010010', 2, 'checking', 4500.00, 'active', 0.0050);

-- Update frozen account details
UPDATE accounts SET freeze_reason = 'Suspicious activity detected', frozen_at = NOW(), frozen_by = 1 WHERE account_number = '10010008';

-- Insert sample transactions
INSERT INTO transactions (reference_number, from_account_id, to_account_id, transaction_type, amount, status, description, initiated_by, created_at, completed_at) VALUES
('TXN20241214001', 1, 3, 'transfer', 500.00, 'completed', 'Monthly rent payment', 2, DATE_SUB(NOW(), INTERVAL 2 DAY), DATE_SUB(NOW(), INTERVAL 2 DAY)),
('TXN20241214002', NULL, 1, 'deposit', 2000.00, 'completed', 'Salary deposit', 2, DATE_SUB(NOW(), INTERVAL 1 DAY), DATE_SUB(NOW(), INTERVAL 1 DAY)),
('TXN20241214003', 4, 5, 'transfer', 1500.00, 'completed', 'Business payment', 3, DATE_SUB(NOW(), INTERVAL 1 DAY), DATE_SUB(NOW(), INTERVAL 1 DAY)),
('TXN20241214004', 3, NULL, 'withdrawal', 300.00, 'completed', 'ATM withdrawal', 2, NOW(), NOW()),
('TXN20241214005', 6, 9, 'transfer', 250.00, 'pending', 'Gift transfer', 2, NOW(), NULL),
('TXN20241214006', 5, 1, 'transfer', 10000.00, 'failed', 'Large transfer attempt', 2, NOW(), NULL),
('TXN20241214007', NULL, 6, 'deposit', 1000.00, 'completed', 'Cash deposit', 3, NOW(), NOW());

-- Update failed transaction reason
UPDATE transactions SET failure_reason = 'Insufficient funds' WHERE reference_number = 'TXN20241214006';

-- Insert transaction history
INSERT INTO transaction_history (transaction_id, from_state, to_state, changed_by, reason) VALUES
(1, 'pending', 'processing', 2, 'Transfer initiated'),
(1, 'processing', 'completed', 2, 'Transfer completed'),
(2, 'pending', 'processing', 2, 'Deposit initiated'),
(2, 'processing', 'completed', 2, 'Deposit completed'),
(3, 'pending', 'processing', 3, 'Transfer initiated'),
(3, 'processing', 'completed', 3, 'Transfer completed'),
(4, 'pending', 'processing', 2, 'Withdrawal initiated'),
(4, 'processing', 'completed', 2, 'Withdrawal completed'),
(6, 'pending', 'failed', 2, 'Insufficient funds');

-- Insert audit logs
INSERT INTO audit_logs (user_id, action, entity_type, entity_id, reason, created_at) VALUES
(1, 'USER_LOGIN', 'user', 1, 'Admin logged in', DATE_SUB(NOW(), INTERVAL 2 HOUR)),
(2, 'CREATE_TRANSACTION', 'transaction', 1, 'Transfer created', DATE_SUB(NOW(), INTERVAL 2 DAY)),
(2, 'CREATE_TRANSACTION', 'transaction', 2, 'Deposit created', DATE_SUB(NOW(), INTERVAL 1 DAY)),
(1, 'FREEZE_ACCOUNT', 'account', 8, 'Suspicious activity detected', DATE_SUB(NOW(), INTERVAL 12 HOUR)),
(3, 'CREATE_TRANSACTION', 'transaction', 3, 'Business payment initiated', DATE_SUB(NOW(), INTERVAL 1 DAY));

SELECT 'Database schema created successfully!' AS Status;
