const express = require('express');
const pool = require('../config/database');
const { authenticateToken, tellerAndAbove, allAuthenticated } = require('../middleware/auth');

const router = express.Router();

// Get all transactions
router.get('/', authenticateToken, allAuthenticated, async (req, res) => {
    try {
        const { status, type, dateFrom, dateTo, limit } = req.query;
        
        let query = 'SELECT * FROM vw_transaction_details WHERE 1=1';
        const params = [];
        
        if (status) {
            query += ' AND status = ?';
            params.push(status);
        }
        
        if (type) {
            query += ' AND transaction_type = ?';
            params.push(type);
        }
        
        if (dateFrom) {
            query += ' AND DATE(created_at) >= ?';
            params.push(dateFrom);
        }
        
        if (dateTo) {
            query += ' AND DATE(created_at) <= ?';
            params.push(dateTo);
        }
        
        query += ' ORDER BY created_at DESC';
        query += ` LIMIT ${parseInt(limit) || 100}`;
        
        const [transactions] = await pool.execute(query, params);
        
        res.json({
            success: true,
            data: transactions,
            count: transactions.length
        });
    } catch (error) {
        console.error('Get transactions error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch transactions'
        });
    }
});

// Get transaction by ID
router.get('/:id', authenticateToken, allAuthenticated, async (req, res) => {
    try {
        const [transactions] = await pool.execute(
            'SELECT * FROM vw_transaction_details WHERE transaction_id = ?',
            [req.params.id]
        );
        
        if (transactions.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Transaction not found'
            });
        }
        
        // Get transaction history
        const [history] = await pool.execute(
            `SELECT th.*, u.full_name as changed_by_name 
             FROM transaction_history th 
             LEFT JOIN users u ON th.changed_by = u.user_id 
             WHERE th.transaction_id = ? 
             ORDER BY th.created_at ASC`,
            [req.params.id]
        );
        
        res.json({
            success: true,
            data: {
                ...transactions[0],
                history
            }
        });
    } catch (error) {
        console.error('Get transaction error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch transaction'
        });
    }
});

// Get transaction lifecycle/history
router.get('/:id/history', authenticateToken, allAuthenticated, async (req, res) => {
    try {
        const [history] = await pool.execute(
            `SELECT th.*, u.full_name as changed_by_name 
             FROM transaction_history th 
             LEFT JOIN users u ON th.changed_by = u.user_id 
             WHERE th.transaction_id = ? 
             ORDER BY th.created_at ASC`,
            [req.params.id]
        );
        
        res.json({
            success: true,
            data: history
        });
    } catch (error) {
        console.error('Get transaction history error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch transaction history'
        });
    }
});

// Create deposit
router.post('/deposit', authenticateToken, tellerAndAbove, async (req, res) => {
    try {
        const { accountId, amount, description } = req.body;
        
        if (!accountId || !amount) {
            return res.status(400).json({
                success: false,
                message: 'Account ID and amount are required'
            });
        }
        
        if (amount <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Amount must be greater than zero'
            });
        }
        
        await pool.execute(
            'CALL sp_deposit(?, ?, ?, ?, @transaction_id, @reference, @status, @message)',
            [accountId, amount, description || 'Cash deposit', req.user.userId]
        );
        
        const [[output]] = await pool.execute(
            'SELECT @transaction_id as transactionId, @reference as reference, @status as status, @message as message'
        );
        
        if (output.status === 'failed') {
            return res.status(400).json({
                success: false,
                message: output.message
            });
        }
        
        res.status(201).json({
            success: true,
            message: output.message,
            data: {
                transactionId: output.transactionId,
                reference: output.reference,
                status: output.status
            }
        });
    } catch (error) {
        console.error('Deposit error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to process deposit'
        });
    }
});

// Create withdrawal
router.post('/withdraw', authenticateToken, tellerAndAbove, async (req, res) => {
    try {
        const { accountId, amount, description } = req.body;
        
        if (!accountId || !amount) {
            return res.status(400).json({
                success: false,
                message: 'Account ID and amount are required'
            });
        }
        
        if (amount <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Amount must be greater than zero'
            });
        }
        
        await pool.execute(
            'CALL sp_withdraw(?, ?, ?, ?, @transaction_id, @reference, @status, @message)',
            [accountId, amount, description || 'Cash withdrawal', req.user.userId]
        );
        
        const [[output]] = await pool.execute(
            'SELECT @transaction_id as transactionId, @reference as reference, @status as status, @message as message'
        );
        
        if (output.status === 'failed') {
            return res.status(400).json({
                success: false,
                message: output.message,
                data: {
                    transactionId: output.transactionId,
                    reference: output.reference,
                    status: output.status
                }
            });
        }
        
        res.status(201).json({
            success: true,
            message: output.message,
            data: {
                transactionId: output.transactionId,
                reference: output.reference,
                status: output.status
            }
        });
    } catch (error) {
        console.error('Withdrawal error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to process withdrawal'
        });
    }
});

// Create transfer
router.post('/transfer', authenticateToken, tellerAndAbove, async (req, res) => {
    try {
        const { fromAccountId, toAccountId, amount, description } = req.body;
        
        if (!fromAccountId || !toAccountId || !amount) {
            return res.status(400).json({
                success: false,
                message: 'From account, to account, and amount are required'
            });
        }
        
        if (amount <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Amount must be greater than zero'
            });
        }
        
        await pool.execute(
            'CALL sp_transfer(?, ?, ?, ?, ?, @transaction_id, @reference, @status, @message)',
            [fromAccountId, toAccountId, amount, description || 'Fund transfer', req.user.userId]
        );
        
        const [[output]] = await pool.execute(
            'SELECT @transaction_id as transactionId, @reference as reference, @status as status, @message as message'
        );
        
        if (output.status === 'failed') {
            return res.status(400).json({
                success: false,
                message: output.message,
                data: {
                    transactionId: output.transactionId,
                    reference: output.reference,
                    status: output.status
                }
            });
        }
        
        res.status(201).json({
            success: true,
            message: output.message,
            data: {
                transactionId: output.transactionId,
                reference: output.reference,
                status: output.status
            }
        });
    } catch (error) {
        console.error('Transfer error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to process transfer'
        });
    }
});

// Get pending transactions
router.get('/status/pending', authenticateToken, allAuthenticated, async (req, res) => {
    try {
        const [transactions] = await pool.execute(
            'SELECT * FROM vw_transaction_details WHERE status = "pending" ORDER BY created_at DESC'
        );
        
        res.json({
            success: true,
            data: transactions
        });
    } catch (error) {
        console.error('Get pending transactions error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch pending transactions'
        });
    }
});

// Get failed transactions
router.get('/status/failed', authenticateToken, allAuthenticated, async (req, res) => {
    try {
        const { today } = req.query;
        
        let query = 'SELECT * FROM vw_transaction_details WHERE status = "failed"';
        if (today === 'true') {
            query += ' AND DATE(created_at) = CURDATE()';
        }
        query += ' ORDER BY created_at DESC';
        
        const [transactions] = await pool.execute(query);
        
        res.json({
            success: true,
            data: transactions
        });
    } catch (error) {
        console.error('Get failed transactions error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch failed transactions'
        });
    }
});

// Get stuck transactions
router.get('/status/stuck', authenticateToken, allAuthenticated, async (req, res) => {
    try {
        const [transactions] = await pool.execute(
            'SELECT * FROM vw_transaction_details WHERE status = "stuck" ORDER BY created_at DESC'
        );
        
        res.json({
            success: true,
            data: transactions
        });
    } catch (error) {
        console.error('Get stuck transactions error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch stuck transactions'
        });
    }
});

module.exports = router;
