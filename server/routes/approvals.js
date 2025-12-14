const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// Get all pending approvals (Manager/Admin only)
router.get('/pending', authenticateToken, authorizeRoles('manager', 'admin'), async (req, res) => {
    try {
        const [approvals] = await db.query(`
            SELECT 
                pa.approval_id,
                pa.transaction_id,
                t.reference_number,
                fa.account_number as from_account_number,
                CONCAT(fh.first_name, ' ', fh.last_name) as from_holder_name,
                ta.account_number as to_account_number,
                CONCAT(th.first_name, ' ', th.last_name) as to_holder_name,
                pa.amount,
                pa.description,
                u.full_name as requested_by_name,
                pa.created_at,
                pa.status
            FROM pending_approvals pa
            JOIN transactions t ON pa.transaction_id = t.transaction_id
            JOIN accounts fa ON pa.from_account_id = fa.account_id
            JOIN account_holders fh ON fa.holder_id = fh.holder_id
            JOIN accounts ta ON pa.to_account_id = ta.account_id
            JOIN account_holders th ON ta.holder_id = th.holder_id
            JOIN users u ON pa.requested_by = u.user_id
            WHERE pa.status = 'pending'
            ORDER BY pa.created_at DESC
        `);

        res.json({
            success: true,
            data: approvals
        });
    } catch (error) {
        console.error('Get pending approvals error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch pending approvals',
            error: error.message
        });
    }
});

// Get approval history (Manager/Admin only)
router.get('/history', authenticateToken, authorizeRoles('manager', 'admin'), async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;

        const [approvals] = await db.query(`
            SELECT 
                pa.approval_id,
                pa.transaction_id,
                t.reference_number,
                fa.account_number as from_account_number,
                CONCAT(fh.first_name, ' ', fh.last_name) as from_holder_name,
                ta.account_number as to_account_number,
                CONCAT(th.first_name, ' ', th.last_name) as to_holder_name,
                pa.amount,
                pa.description,
                u1.full_name as requested_by_name,
                u2.full_name as approved_by_name,
                pa.status,
                pa.rejection_reason,
                pa.created_at,
                pa.processed_at
            FROM pending_approvals pa
            JOIN transactions t ON pa.transaction_id = t.transaction_id
            JOIN accounts fa ON pa.from_account_id = fa.account_id
            JOIN account_holders fh ON fa.holder_id = fh.holder_id
            JOIN accounts ta ON pa.to_account_id = ta.account_id
            JOIN account_holders th ON ta.holder_id = th.holder_id
            JOIN users u1 ON pa.requested_by = u1.user_id
            LEFT JOIN users u2 ON pa.approved_by = u2.user_id
            WHERE pa.status IN ('approved', 'rejected')
            ORDER BY pa.processed_at DESC
            LIMIT ? OFFSET ?
        `, [limit, offset]);

        res.json({
            success: true,
            data: approvals
        });
    } catch (error) {
        console.error('Get approval history error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch approval history',
            error: error.message
        });
    }
});

// Approve or reject a pending transfer (Manager/Admin only)
router.post('/:approvalId/process', authenticateToken, authorizeRoles('manager', 'admin'), async (req, res) => {
    const { approvalId } = req.params;
    const { approve, rejectionReason } = req.body;
    const userId = req.user.userId;

    try {
        // Validate input
        if (approve === undefined || approve === null) {
            return res.status(400).json({
                success: false,
                message: 'Approve parameter is required'
            });
        }

        if (!approve && !rejectionReason) {
            return res.status(400).json({
                success: false,
                message: 'Rejection reason is required when rejecting'
            });
        }

        // Call stored procedure
        const [results] = await db.query(
            'CALL sp_approve_transfer(?, ?, ?, ?, @status, @message)',
            [approvalId, userId, approve ? 1 : 0, rejectionReason || null]
        );

        // Get output parameters
        const [output] = await db.query('SELECT @status as status, @message as message');
        const { status, message } = output[0];

        if (status === 'completed' || status === 'rejected') {
            res.json({
                success: true,
                status,
                message
            });
        } else {
            res.status(400).json({
                success: false,
                status,
                message
            });
        }
    } catch (error) {
        console.error('Approve transfer error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to process approval',
            error: error.message
        });
    }
});

// Get approval details by ID (Manager/Admin only)
router.get('/:approvalId', authenticateToken, authorizeRoles('manager', 'admin'), async (req, res) => {
    const { approvalId } = req.params;

    try {
        const [approvals] = await db.query(`
            SELECT 
                pa.approval_id,
                pa.transaction_id,
                t.reference_number,
                pa.from_account_id,
                fa.account_number as from_account_number,
                CONCAT(fh.first_name, ' ', fh.last_name) as from_holder_name,
                fh.email as from_holder_email,
                pa.to_account_id,
                ta.account_number as to_account_number,
                CONCAT(th.first_name, ' ', th.last_name) as to_holder_name,
                th.email as to_holder_email,
                pa.amount,
                pa.description,
                u1.full_name as requested_by_name,
                u2.full_name as approved_by_name,
                pa.status,
                pa.rejection_reason,
                pa.created_at,
                pa.processed_at,
                t.status as transaction_status
            FROM pending_approvals pa
            JOIN transactions t ON pa.transaction_id = t.transaction_id
            JOIN accounts fa ON pa.from_account_id = fa.account_id
            JOIN account_holders fh ON fa.holder_id = fh.holder_id
            JOIN accounts ta ON pa.to_account_id = ta.account_id
            JOIN account_holders th ON ta.holder_id = th.holder_id
            JOIN users u1 ON pa.requested_by = u1.user_id
            LEFT JOIN users u2 ON pa.approved_by = u2.user_id
            WHERE pa.approval_id = ?
        `, [approvalId]);

        if (approvals.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Approval request not found'
            });
        }

        res.json({
            success: true,
            data: approvals[0]
        });
    } catch (error) {
        console.error('Get approval details error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch approval details',
            error: error.message
        });
    }
});

module.exports = router;
