const express = require('express');
const pool = require('../config/database');
const { authenticateToken, allAuthenticated } = require('../middleware/auth');

const router = express.Router();

// Get all audit logs
router.get('/', authenticateToken, allAuthenticated, async (req, res) => {
    try {
        const { action, entityType, dateFrom, dateTo, limit, page } = req.query;
        
        const pageSize = parseInt(limit) || 50;
        const pageNum = parseInt(page) || 1;
        const offset = (pageNum - 1) * pageSize;
        
        let query = 'SELECT * FROM vw_audit_logs WHERE 1=1';
        let countQuery = 'SELECT COUNT(*) as total FROM vw_audit_logs WHERE 1=1';
        const params = [];
        
        if (action) {
            query += ' AND action = ?';
            countQuery += ' AND action = ?';
            params.push(action);
        }
        
        if (entityType) {
            query += ' AND entity_type = ?';
            countQuery += ' AND entity_type = ?';
            params.push(entityType);
        }
        
        if (dateFrom) {
            query += ' AND DATE(created_at) >= ?';
            countQuery += ' AND DATE(created_at) >= ?';
            params.push(dateFrom);
        }
        
        if (dateTo) {
            query += ' AND DATE(created_at) <= ?';
            countQuery += ' AND DATE(created_at) <= ?';
            params.push(dateTo);
        }
        
        // Get total count
        const [countResult] = await pool.execute(countQuery, params);
        const total = countResult[0].total;
        
        query += ' ORDER BY created_at DESC';
        query += ` LIMIT ${pageSize} OFFSET ${offset}`;
        
        const [logs] = await pool.execute(query, params);
        
        res.json({
            success: true,
            data: logs,
            pagination: {
                page: pageNum,
                pageSize,
                total,
                totalPages: Math.ceil(total / pageSize)
            }
        });
    } catch (error) {
        console.error('Get audit logs error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch audit logs'
        });
    }
});

// Get distinct action types
router.get('/actions', authenticateToken, allAuthenticated, async (req, res) => {
    try {
        const [actions] = await pool.execute(
            'SELECT DISTINCT action FROM audit_logs ORDER BY action'
        );
        
        res.json({
            success: true,
            data: actions.map(a => a.action)
        });
    } catch (error) {
        console.error('Get actions error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch action types'
        });
    }
});

// Get distinct entity types
router.get('/entity-types', authenticateToken, allAuthenticated, async (req, res) => {
    try {
        const [types] = await pool.execute(
            'SELECT DISTINCT entity_type FROM audit_logs ORDER BY entity_type'
        );
        
        res.json({
            success: true,
            data: types.map(t => t.entity_type)
        });
    } catch (error) {
        console.error('Get entity types error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch entity types'
        });
    }
});

// Get logs for specific entity
router.get('/entity/:type/:id', authenticateToken, allAuthenticated, async (req, res) => {
    try {
        const [logs] = await pool.execute(
            'SELECT * FROM vw_audit_logs WHERE entity_type = ? AND entity_id = ? ORDER BY created_at DESC',
            [req.params.type, req.params.id]
        );
        
        res.json({
            success: true,
            data: logs
        });
    } catch (error) {
        console.error('Get entity logs error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch entity logs'
        });
    }
});

module.exports = router;
