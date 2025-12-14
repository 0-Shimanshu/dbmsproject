require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

// Import routes
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const accountsRoutes = require('./routes/accounts');
const transactionsRoutes = require('./routes/transactions');
const reversalsRoutes = require('./routes/reversals');
const approvalsRoutes = require('./routes/approvals');
const logsRoutes = require('./routes/logs');
const reportsRoutes = require('./routes/reports');
const simulationRoutes = require('./routes/simulation');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from client folder
app.use(express.static(path.join(__dirname, '../client')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/accounts', accountsRoutes);
app.use('/api/transactions', transactionsRoutes);
app.use('/api/reversals', reversalsRoutes);
app.use('/api/approvals', approvalsRoutes);
app.use('/api/logs', logsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/simulation', simulationRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Serve index.html for all non-API routes (SPA support)
app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
        res.sendFile(path.join(__dirname, '../client/index.html'));
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server Error:', err);
    res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════════════════╗
║                                                          ║
║     Banking Management System - Backend Server           ║
║                                                          ║
║     Server running on: http://localhost:${PORT}             ║
║                                                          ║
║     API Endpoints:                                       ║
║       POST /api/auth/login                              ║
║       GET  /api/dashboard/summary                       ║
║       GET  /api/accounts                                ║
║       GET  /api/transactions                            ║
║       GET  /api/reversals                               ║
║       GET  /api/logs                                    ║
║       GET  /api/reports                                 ║
║       POST /api/simulation/*                            ║
║                                                          ║
║     Default Login Credentials:                           ║
║       Admin:   admin / password123                      ║
║       Teller:  teller1 / password123                    ║
║       Manager: manager1 / password123                   ║
║       Auditor: auditor1 / password123                   ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
    `);
});

module.exports = app;
