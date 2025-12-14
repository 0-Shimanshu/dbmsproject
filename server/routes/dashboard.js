const express = require('express');
const pool = require('../config/database');
const { authenticateToken, allAuthenticated } = require('../middleware/auth');

const router = express.Router();

// Get dashboard summary
router.get('/summary', authenticateToken, allAuthenticated, async (req, res) => {
    try {
        const [summary] = await pool.execute('SELECT * FROM vw_dashboard_summary');
        
        res.json({
            success: true,
            data: summary[0]
        });
    } catch (error) {
        console.error('Dashboard summary error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch dashboard summary'
        });
    }
});

// Get recent activity
router.get('/recent-activity', authenticateToken, allAuthenticated, async (req, res) => {
    try {
        const [activities] = await pool.execute('SELECT * FROM vw_recent_activity LIMIT 20');
        
        res.json({
            success: true,
            data: activities
        });
    } catch (error) {
        console.error('Recent activity error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch recent activity'
        });
    }
});

// Get daily transaction stats
router.get('/transaction-stats', authenticateToken, allAuthenticated, async (req, res) => {
    try {
        const [stats] = await pool.execute('SELECT * FROM vw_daily_transaction_stats LIMIT 30');
        
        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('Transaction stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch transaction stats'
        });
    }
});

// Get system health
router.get('/system-health', authenticateToken, allAuthenticated, async (req, res) => {
    try {
        // Check database connection
        const [dbCheck] = await pool.execute('SELECT 1 as status');
        
        // Get stuck transactions count
        const [stuck] = await pool.execute(
            'SELECT COUNT(*) as count FROM transactions WHERE status = "stuck"'
        );
        
        // Get pending transactions older than 5 minutes
        const [pendingOld] = await pool.execute(
            'SELECT COUNT(*) as count FROM transactions WHERE status = "pending" AND created_at < DATE_SUB(NOW(), INTERVAL 5 MINUTE)'
        );
        
        const health = {
            database: dbCheck.length > 0 ? 'healthy' : 'unhealthy',
            stuckTransactions: stuck[0].count,
            stalePendingTransactions: pendingOld[0].count,
            overallStatus: stuck[0].count === 0 && pendingOld[0].count === 0 ? 'healthy' : 'warning',
            timestamp: new Date().toISOString()
        };
        
        res.json({
            success: true,
            data: health
        });
    } catch (error) {
        console.error('System health error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to check system health',
            data: {
                database: 'unhealthy',
                overallStatus: 'critical'
            }
        });
    }
});

module.exports = router;
