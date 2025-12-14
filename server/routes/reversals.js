const express = require('express');
const pool = require('../config/database');
const { authenticateToken, managerOrAdmin, allAuthenticated } = require('../middleware/auth');

const router = express.Router();

// Get all reversible transactions
router.get('/reversible', authenticateToken, allAuthenticated, async (req, res) => {
    try {
        const [transactions] = await pool.execute('SELECT * FROM vw_reversible_transactions ORDER BY completed_at DESC');
        
        res.json({
            success: true,
            data: transactions
        });
    } catch (error) {
        console.error('Get reversible transactions error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch reversible transactions'
        });
    }
});

// Get all reversals
router.get('/', authenticateToken, allAuthenticated, async (req, res) => {
    try {
        const { status } = req.query;
        
        let query = `
            SELECT r.*, 
                   t.reference_number as original_reference,
                   t.amount,
                   t.transaction_type,
                   ur.full_name as requested_by_name,
                   ua.full_name as approved_by_name
            FROM reversals r
            JOIN transactions t ON r.original_transaction_id = t.transaction_id
            LEFT JOIN users ur ON r.requested_by = ur.user_id
            LEFT JOIN users ua ON r.approved_by = ua.user_id
            WHERE 1=1
        `;
        const params = [];
        
        if (status) {
            query += ' AND r.status = ?';
            params.push(status);
        }
        
        query += ' ORDER BY r.created_at DESC';
        
        const [reversals] = await pool.execute(query, params);
        
        res.json({
            success: true,
            data: reversals
        });
    } catch (error) {
        console.error('Get reversals error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch reversals'
        });
    }
});

// Get reversal by ID
router.get('/:id', authenticateToken, allAuthenticated, async (req, res) => {
    try {
        const [reversals] = await pool.execute(
            `SELECT r.*, 
                    t.reference_number as original_reference,
                    t.amount,
                    t.transaction_type,
                    t.from_account_id,
                    t.to_account_id,
                    ur.full_name as requested_by_name,
                    ua.full_name as approved_by_name
             FROM reversals r
             JOIN transactions t ON r.original_transaction_id = t.transaction_id
             LEFT JOIN users ur ON r.requested_by = ur.user_id
             LEFT JOIN users ua ON r.approved_by = ua.user_id
             WHERE r.reversal_id = ?`,
            [req.params.id]
        );
        
        if (reversals.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Reversal not found'
            });
        }
        
        res.json({
            success: true,
            data: reversals[0]
        });
    } catch (error) {
        console.error('Get reversal error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch reversal'
        });
    }
});

// Create reversal request
router.post('/', authenticateToken, managerOrAdmin, async (req, res) => {
    try {
        const { transactionId, reason } = req.body;
        
        if (!transactionId || !reason) {
            return res.status(400).json({
                success: false,
                message: 'Transaction ID and reason are required'
            });
        }
        
        await pool.execute(
            'CALL sp_reverse_transaction(?, ?, ?, @reversal_id, @status, @message)',
            [transactionId, reason, req.user.userId]
        );
        
        const [[output]] = await pool.execute(
            'SELECT @reversal_id as reversalId, @status as status, @message as message'
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
                reversalId: output.reversalId,
                status: output.status
            }
        });
    } catch (error) {
        console.error('Create reversal error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to process reversal'
        });
    }
});

module.exports = router;
