const express = require('express');
const pool = require('../config/database');
const { authenticateToken, allAuthenticated } = require('../middleware/auth');

const router = express.Router();

// Get daily transaction statistics
router.get('/daily-stats', authenticateToken, allAuthenticated, async (req, res) => {
    try {
        const { days } = req.query;
        const numDays = parseInt(days) || 30;
        
        const [stats] = await pool.execute(
            `SELECT * FROM vw_daily_transaction_stats 
             WHERE transaction_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
             ORDER BY transaction_date ASC`,
            [numDays]
        );
        
        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('Get daily stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch daily statistics'
        });
    }
});

// Get transaction summary by type
router.get('/by-type', authenticateToken, allAuthenticated, async (req, res) => {
    try {
        const [summary] = await pool.execute(
            `SELECT 
                transaction_type,
                COUNT(*) as count,
                SUM(amount) as total_amount,
                AVG(amount) as avg_amount,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
                SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
             FROM transactions
             WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
             GROUP BY transaction_type
             ORDER BY count DESC`
        );
        
        res.json({
            success: true,
            data: summary
        });
    } catch (error) {
        console.error('Get type summary error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch type summary'
        });
    }
});

// Get account statistics
router.get('/accounts', authenticateToken, allAuthenticated, async (req, res) => {
    try {
        const [summary] = await pool.execute(
            `SELECT 
                account_type,
                status,
                COUNT(*) as count,
                SUM(balance) as total_balance,
                AVG(balance) as avg_balance
             FROM accounts
             GROUP BY account_type, status
             ORDER BY account_type, status`
        );
        
        const [totals] = await pool.execute(
            `SELECT 
                COUNT(*) as total_accounts,
                SUM(balance) as total_balance,
                SUM(held_balance) as total_held,
                AVG(balance) as avg_balance
             FROM accounts`
        );
        
        res.json({
            success: true,
            data: {
                byTypeAndStatus: summary,
                totals: totals[0]
            }
        });
    } catch (error) {
        console.error('Get account stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch account statistics'
        });
    }
});

// Get success vs failure rate
router.get('/success-rate', authenticateToken, allAuthenticated, async (req, res) => {
    try {
        const [rates] = await pool.execute(
            `SELECT 
                DATE(created_at) as date,
                COUNT(*) as total,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as success,
                SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
                ROUND(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as success_rate
             FROM transactions
             WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
             GROUP BY DATE(created_at)
             ORDER BY date ASC`
        );
        
        res.json({
            success: true,
            data: rates
        });
    } catch (error) {
        console.error('Get success rate error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch success rate'
        });
    }
});

// Get hourly transaction volume
router.get('/hourly-volume', authenticateToken, allAuthenticated, async (req, res) => {
    try {
        const [volume] = await pool.execute(
            `SELECT 
                HOUR(created_at) as hour,
                COUNT(*) as count,
                SUM(amount) as total_amount
             FROM transactions
             WHERE DATE(created_at) = CURDATE()
             GROUP BY HOUR(created_at)
             ORDER BY hour ASC`
        );
        
        res.json({
            success: true,
            data: volume
        });
    } catch (error) {
        console.error('Get hourly volume error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch hourly volume'
        });
    }
});

// Get top accounts by volume
router.get('/top-accounts', authenticateToken, allAuthenticated, async (req, res) => {
    try {
        const [accounts] = await pool.execute(
            `SELECT 
                a.account_number,
                CONCAT(h.first_name, ' ', h.last_name) as holder_name,
                a.account_type,
                a.balance,
                COUNT(t.transaction_id) as transaction_count,
                SUM(t.amount) as total_volume
             FROM accounts a
             JOIN account_holders h ON a.holder_id = h.holder_id
             LEFT JOIN transactions t ON a.account_id = t.from_account_id OR a.account_id = t.to_account_id
             WHERE t.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
             GROUP BY a.account_id
             ORDER BY total_volume DESC
             LIMIT 10`
        );
        
        res.json({
            success: true,
            data: accounts
        });
    } catch (error) {
        console.error('Get top accounts error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch top accounts'
        });
    }
});

module.exports = router;
