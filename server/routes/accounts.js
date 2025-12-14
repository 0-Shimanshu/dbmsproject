const express = require('express');
const pool = require('../config/database');
const { authenticateToken, tellerAndAbove, managerOrAdmin, allAuthenticated } = require('../middleware/auth');

const router = express.Router();

// Get all accounts
router.get('/', authenticateToken, allAuthenticated, async (req, res) => {
    try {
        const { status, type, search } = req.query;
        
        let query = 'SELECT * FROM vw_account_details WHERE 1=1';
        const params = [];
        
        if (status) {
            query += ' AND status = ?';
            params.push(status);
        }
        
        if (type) {
            query += ' AND account_type = ?';
            params.push(type);
        }
        
        if (search) {
            query += ' AND (account_number LIKE ? OR holder_name LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }
        
        query += ' ORDER BY created_at DESC';
        
        const [accounts] = await pool.execute(query, params);
        
        res.json({
            success: true,
            data: accounts,
            count: accounts.length
        });
    } catch (error) {
        console.error('Get accounts error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch accounts'
        });
    }
});

// Get account by ID
router.get('/:id', authenticateToken, allAuthenticated, async (req, res) => {
    try {
        const [accounts] = await pool.execute(
            'SELECT * FROM vw_account_details WHERE account_id = ?',
            [req.params.id]
        );
        
        if (accounts.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Account not found'
            });
        }
        
        res.json({
            success: true,
            data: accounts[0]
        });
    } catch (error) {
        console.error('Get account error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch account'
        });
    }
});

// Get account by account number
router.get('/number/:accountNumber', authenticateToken, allAuthenticated, async (req, res) => {
    try {
        const [accounts] = await pool.execute(
            'SELECT * FROM vw_account_details WHERE account_number = ?',
            [req.params.accountNumber]
        );
        
        if (accounts.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Account not found'
            });
        }
        
        res.json({
            success: true,
            data: accounts[0]
        });
    } catch (error) {
        console.error('Get account error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch account'
        });
    }
});

// Create new account
router.post('/', authenticateToken, tellerAndAbove, async (req, res) => {
    try {
        const { holderId, accountType, initialDeposit } = req.body;
        
        if (!holderId || !accountType) {
            return res.status(400).json({
                success: false,
                message: 'Holder ID and account type are required'
            });
        }
        
        const [result] = await pool.execute(
            'CALL sp_create_account(?, ?, ?, ?, @account_id, @account_number, @status, @message)',
            [holderId, accountType, initialDeposit || 0, req.user.userId]
        );
        
        const [[output]] = await pool.execute(
            'SELECT @account_id as accountId, @account_number as accountNumber, @status as status, @message as message'
        );
        
        if (output.status === 'error') {
            return res.status(400).json({
                success: false,
                message: output.message
            });
        }
        
        res.status(201).json({
            success: true,
            message: output.message,
            data: {
                accountId: output.accountId,
                accountNumber: output.accountNumber
            }
        });
    } catch (error) {
        console.error('Create account error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create account'
        });
    }
});

// Freeze account
router.post('/:id/freeze', authenticateToken, managerOrAdmin, async (req, res) => {
    try {
        const { reason } = req.body;
        
        if (!reason) {
            return res.status(400).json({
                success: false,
                message: 'Freeze reason is required'
            });
        }
        
        await pool.execute(
            'CALL sp_freeze_account(?, ?, ?, @status, @message)',
            [req.params.id, reason, req.user.userId]
        );
        
        const [[output]] = await pool.execute(
            'SELECT @status as status, @message as message'
        );
        
        if (output.status === 'error') {
            return res.status(400).json({
                success: false,
                message: output.message
            });
        }
        
        res.json({
            success: true,
            message: output.message
        });
    } catch (error) {
        console.error('Freeze account error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to freeze account'
        });
    }
});

// Unfreeze account
router.post('/:id/unfreeze', authenticateToken, managerOrAdmin, async (req, res) => {
    try {
        const { reason } = req.body;
        
        if (!reason) {
            return res.status(400).json({
                success: false,
                message: 'Unfreeze reason is required'
            });
        }
        
        await pool.execute(
            'CALL sp_unfreeze_account(?, ?, ?, @status, @message)',
            [req.params.id, reason, req.user.userId]
        );
        
        const [[output]] = await pool.execute(
            'SELECT @status as status, @message as message'
        );
        
        if (output.status === 'error') {
            return res.status(400).json({
                success: false,
                message: output.message
            });
        }
        
        res.json({
            success: true,
            message: output.message
        });
    } catch (error) {
        console.error('Unfreeze account error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to unfreeze account'
        });
    }
});

// Get account transaction history
router.get('/:id/transactions', authenticateToken, allAuthenticated, async (req, res) => {
    try {
        const [transactions] = await pool.execute(
            `SELECT * FROM vw_transaction_details 
             WHERE from_account = (SELECT account_number FROM accounts WHERE account_id = ?)
                OR to_account = (SELECT account_number FROM accounts WHERE account_id = ?)
             ORDER BY created_at DESC
             LIMIT 50`,
            [req.params.id, req.params.id]
        );
        
        res.json({
            success: true,
            data: transactions
        });
    } catch (error) {
        console.error('Get account transactions error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch account transactions'
        });
    }
});

// Get all account holders
router.get('/holders/list', authenticateToken, allAuthenticated, async (req, res) => {
    try {
        const [holders] = await pool.execute(
            'SELECT holder_id, first_name, last_name, email, phone, id_number FROM account_holders ORDER BY first_name, last_name'
        );
        
        res.json({
            success: true,
            data: holders
        });
    } catch (error) {
        console.error('Get holders error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch account holders'
        });
    }
});

module.exports = router;
