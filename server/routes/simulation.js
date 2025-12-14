const express = require('express');
const pool = require('../config/database');
const { authenticateToken, tellerAndAbove, managerOrAdmin } = require('../middleware/auth');

const router = express.Router();

// Simulate successful transaction
router.post('/success', authenticateToken, tellerAndAbove, async (req, res) => {
    try {
        // Get two active accounts for simulation
        const [accounts] = await pool.execute(
            'SELECT account_id FROM accounts WHERE status = "active" AND balance >= 100 ORDER BY RAND() LIMIT 2'
        );
        
        if (accounts.length < 2) {
            return res.status(400).json({
                success: false,
                message: 'Not enough active accounts for simulation'
            });
        }
        
        const amount = Math.floor(Math.random() * 500) + 50; // Random amount 50-550
        
        await pool.execute(
            'CALL sp_transfer(?, ?, ?, ?, ?, @transaction_id, @reference, @status, @message)',
            [accounts[0].account_id, accounts[1].account_id, amount, 'Simulated successful transfer', req.user.userId]
        );
        
        const [[output]] = await pool.execute(
            'SELECT @transaction_id as transactionId, @reference as reference, @status as status, @message as message'
        );
        
        res.json({
            success: true,
            message: 'Successful transaction simulated',
            data: {
                transactionId: output.transactionId,
                reference: output.reference,
                status: output.status,
                amount
            }
        });
    } catch (error) {
        console.error('Simulate success error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to simulate successful transaction'
        });
    }
});

// Simulate failed transaction (insufficient funds)
router.post('/failure', authenticateToken, tellerAndAbove, async (req, res) => {
    try {
        // Get account with low balance
        const [accounts] = await pool.execute(
            'SELECT account_id, balance FROM accounts WHERE status = "active" ORDER BY balance ASC LIMIT 1'
        );
        
        if (accounts.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No active accounts for simulation'
            });
        }
        
        const [toAccounts] = await pool.execute(
            'SELECT account_id FROM accounts WHERE status = "active" AND account_id != ? LIMIT 1',
            [accounts[0].account_id]
        );
        
        // Try to transfer more than available
        const amount = accounts[0].balance + 10000;
        
        await pool.execute(
            'CALL sp_transfer(?, ?, ?, ?, ?, @transaction_id, @reference, @status, @message)',
            [accounts[0].account_id, toAccounts[0].account_id, amount, 'Simulated failed transfer (insufficient funds)', req.user.userId]
        );
        
        const [[output]] = await pool.execute(
            'SELECT @transaction_id as transactionId, @reference as reference, @status as status, @message as message'
        );
        
        res.json({
            success: true,
            message: 'Failed transaction simulated',
            data: {
                transactionId: output.transactionId,
                reference: output.reference,
                status: output.status,
                attemptedAmount: amount,
                availableBalance: accounts[0].balance
            }
        });
    } catch (error) {
        console.error('Simulate failure error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to simulate failed transaction'
        });
    }
});

// Simulate stuck transaction
router.post('/stuck', authenticateToken, tellerAndAbove, async (req, res) => {
    try {
        // Get two active accounts for simulation
        const [accounts] = await pool.execute(
            'SELECT account_id FROM accounts WHERE status = "active" AND balance >= 100 ORDER BY RAND() LIMIT 2'
        );
        
        if (accounts.length < 2) {
            return res.status(400).json({
                success: false,
                message: 'Not enough active accounts for simulation'
            });
        }
        
        const amount = Math.floor(Math.random() * 200) + 50;
        
        await pool.execute(
            'CALL sp_simulate_stuck_transaction(?, ?, ?, ?, @transaction_id, @reference, @status, @message)',
            [accounts[0].account_id, accounts[1].account_id, amount, req.user.userId]
        );
        
        const [[output]] = await pool.execute(
            'SELECT @transaction_id as transactionId, @reference as reference, @status as status, @message as message'
        );
        
        res.json({
            success: true,
            message: 'Stuck transaction simulated',
            data: {
                transactionId: output.transactionId,
                reference: output.reference,
                status: output.status,
                amount
            }
        });
    } catch (error) {
        console.error('Simulate stuck error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to simulate stuck transaction'
        });
    }
});

// Recover stuck transaction
router.post('/recover/:id', authenticateToken, managerOrAdmin, async (req, res) => {
    try {
        const { action } = req.body; // 'complete' or 'fail'
        
        if (!action || !['complete', 'fail'].includes(action)) {
            return res.status(400).json({
                success: false,
                message: 'Action must be "complete" or "fail"'
            });
        }
        
        await pool.execute(
            'CALL sp_recover_stuck_transaction(?, ?, ?, @status, @message)',
            [req.params.id, action, req.user.userId]
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
            message: output.message,
            data: {
                status: output.status
            }
        });
    } catch (error) {
        console.error('Recover stuck error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to recover stuck transaction'
        });
    }
});

// Simulate deposit
router.post('/deposit', authenticateToken, tellerAndAbove, async (req, res) => {
    try {
        const [accounts] = await pool.execute(
            'SELECT account_id FROM accounts WHERE status = "active" ORDER BY RAND() LIMIT 1'
        );
        
        if (accounts.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No active accounts for simulation'
            });
        }
        
        const amount = Math.floor(Math.random() * 1000) + 100;
        
        await pool.execute(
            'CALL sp_deposit(?, ?, ?, ?, @transaction_id, @reference, @status, @message)',
            [accounts[0].account_id, amount, 'Simulated cash deposit', req.user.userId]
        );
        
        const [[output]] = await pool.execute(
            'SELECT @transaction_id as transactionId, @reference as reference, @status as status, @message as message'
        );
        
        res.json({
            success: true,
            message: 'Deposit simulated',
            data: {
                transactionId: output.transactionId,
                reference: output.reference,
                status: output.status,
                amount
            }
        });
    } catch (error) {
        console.error('Simulate deposit error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to simulate deposit'
        });
    }
});

// Simulate reversal
router.post('/reversal', authenticateToken, managerOrAdmin, async (req, res) => {
    try {
        // Find a completed transaction to reverse
        const [transactions] = await pool.execute(
            `SELECT transaction_id FROM transactions 
             WHERE status = 'completed' 
             AND transaction_type IN ('transfer', 'deposit', 'withdrawal')
             AND transaction_id NOT IN (SELECT original_transaction_id FROM reversals)
             ORDER BY RAND() LIMIT 1`
        );
        
        if (transactions.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No eligible transactions to reverse'
            });
        }
        
        await pool.execute(
            'CALL sp_reverse_transaction(?, ?, ?, @reversal_id, @status, @message)',
            [transactions[0].transaction_id, 'Simulated reversal for testing', req.user.userId]
        );
        
        const [[output]] = await pool.execute(
            'SELECT @reversal_id as reversalId, @status as status, @message as message'
        );
        
        res.json({
            success: true,
            message: 'Reversal simulated',
            data: {
                reversalId: output.reversalId,
                originalTransactionId: transactions[0].transaction_id,
                status: output.status
            }
        });
    } catch (error) {
        console.error('Simulate reversal error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to simulate reversal'
        });
    }
});

// Bulk simulation
router.post('/bulk', authenticateToken, managerOrAdmin, async (req, res) => {
    try {
        const { count, type } = req.body;
        const numTransactions = Math.min(parseInt(count) || 5, 20);
        
        const results = [];
        
        for (let i = 0; i < numTransactions; i++) {
            const [accounts] = await pool.execute(
                'SELECT account_id FROM accounts WHERE status = "active" AND balance >= 100 ORDER BY RAND() LIMIT 2'
            );
            
            if (accounts.length >= 2) {
                const amount = Math.floor(Math.random() * 500) + 50;
                
                await pool.execute(
                    'CALL sp_transfer(?, ?, ?, ?, ?, @transaction_id, @reference, @status, @message)',
                    [accounts[0].account_id, accounts[1].account_id, amount, `Bulk simulation ${i + 1}`, req.user.userId]
                );
                
                const [[output]] = await pool.execute(
                    'SELECT @transaction_id as transactionId, @reference as reference, @status as status, @message as message'
                );
                
                results.push({
                    transactionId: output.transactionId,
                    reference: output.reference,
                    status: output.status,
                    amount
                });
            }
        }
        
        res.json({
            success: true,
            message: `Bulk simulation completed: ${results.length} transactions`,
            data: results
        });
    } catch (error) {
        console.error('Bulk simulation error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to complete bulk simulation'
        });
    }
});

module.exports = router;
