// Simulation Module

const Simulation = {
    results: [],

    // Initialize
    async init() {
        await this.loadStuckTransactions();
    },

    // Add result to display
    addResult(type, title, details) {
        const container = document.getElementById('simulationResults');

        // Remove empty state if present
        const emptyState = container.querySelector('.empty-state');
        if (emptyState) {
            emptyState.remove();
        }

        const icons = {
            success: '✅',
            failed: '❌',
            stuck: '⏳',
            info: 'ℹ️'
        };

        const result = document.createElement('div');
        result.className = `simulation-result ${type}`;
        result.innerHTML = `
            <span class="simulation-result-icon">${icons[type] || icons.info}</span>
            <div class="simulation-result-content">
                <div class="simulation-result-title">${Utils.escapeHtml(title)}</div>
                <div class="simulation-result-details">${Utils.escapeHtml(details)}</div>
            </div>
        `;

        container.insertBefore(result, container.firstChild);
        this.results.push({ type, title, details });
    },

    // Clear results
    clearResults() {
        const container = document.getElementById('simulationResults');
        container.innerHTML = '<div class="empty-state"><p>No simulations run yet. Click a button above to start.</p></div>';
        this.results = [];
    },

    // Run successful transaction simulation
    async runSuccess() {
        Toast.info('Running', 'Simulating successful transaction...');

        const result = await Api.post('/simulation/success', {});

        if (result.success) {
            this.addResult('success', 'Successful Transfer', 
                `Reference: ${result.data.reference} | Amount: ${Utils.formatCurrency(result.data.amount)}`);
            Toast.success('Success', 'Successful transaction simulated');
            this.refreshData();
        } else {
            this.addResult('failed', 'Simulation Failed', result.message);
            Toast.error('Error', result.message);
        }
    },

    // Run failed transaction simulation
    async runFailure() {
        Toast.info('Running', 'Simulating failed transaction...');

        const result = await Api.post('/simulation/failure', {});

        if (result.success) {
            this.addResult('failed', 'Failed Transfer (Insufficient Funds)', 
                `Reference: ${result.data.reference} | Attempted: ${Utils.formatCurrency(result.data.attemptedAmount)} | Available: ${Utils.formatCurrency(result.data.availableBalance)}`);
            Toast.warning('Simulated', 'Failed transaction simulated');
            this.refreshData();
        } else {
            this.addResult('failed', 'Simulation Error', result.message);
            Toast.error('Error', result.message);
        }
    },

    // Run stuck transaction simulation
    async runStuck() {
        Toast.info('Running', 'Simulating stuck transaction...');

        const result = await Api.post('/simulation/stuck', {});

        if (result.success) {
            this.addResult('stuck', 'Stuck Transaction Created', 
                `Reference: ${result.data.reference} | Amount: ${Utils.formatCurrency(result.data.amount)} | Status: ${result.data.status}`);
            Toast.warning('Simulated', 'Stuck transaction simulated');
            this.refreshData();
            this.loadStuckTransactions();
        } else {
            this.addResult('failed', 'Simulation Error', result.message);
            Toast.error('Error', result.message);
        }
    },

    // Run deposit simulation
    async runDeposit() {
        Toast.info('Running', 'Simulating deposit...');

        const result = await Api.post('/simulation/deposit', {});

        if (result.success) {
            this.addResult('success', 'Deposit Completed', 
                `Reference: ${result.data.reference} | Amount: ${Utils.formatCurrency(result.data.amount)}`);
            Toast.success('Success', 'Deposit simulated');
            this.refreshData();
        } else {
            this.addResult('failed', 'Simulation Error', result.message);
            Toast.error('Error', result.message);
        }
    },

    // Run reversal simulation
    async runReversal() {
        Toast.info('Running', 'Simulating reversal...');

        const result = await Api.post('/simulation/reversal', {});

        if (result.success) {
            this.addResult('info', 'Reversal Completed', 
                `Reversal ID: ${result.data.reversalId} | Original Transaction: ${result.data.originalTransactionId}`);
            Toast.success('Success', 'Reversal simulated');
            this.refreshData();
        } else {
            this.addResult('failed', 'Simulation Error', result.message);
            Toast.error('Error', result.message);
        }
    },

    // Run bulk transactions
    async runBulk() {
        const count = parseInt(document.getElementById('bulkCount').value) || 5;
        Toast.info('Running', `Simulating ${count} transactions...`);

        const result = await Api.post('/simulation/bulk', { count });

        if (result.success) {
            this.addResult('success', `Bulk Simulation: ${result.data.length} Transactions`, 
                `${result.data.filter(r => r.status === 'completed').length} completed, ${result.data.filter(r => r.status === 'failed').length} failed`);
            Toast.success('Success', result.message);
            this.refreshData();
        } else {
            this.addResult('failed', 'Bulk Simulation Error', result.message);
            Toast.error('Error', result.message);
        }
    },

    // Load stuck transactions
    async loadStuckTransactions() {
        const tbody = document.getElementById('stuckTransactionsTableBody');

        const result = await Api.get('/transactions/status/stuck');

        if (result.success && result.data.length > 0) {
            tbody.innerHTML = result.data.map(txn => `
                <tr>
                    <td><code>${Utils.escapeHtml(txn.reference_number)}</code></td>
                    <td>${txn.from_account || '-'}</td>
                    <td>${txn.to_account || '-'}</td>
                    <td>${Utils.formatCurrency(txn.amount)}</td>
                    <td>${Utils.formatRelativeTime(txn.created_at)}</td>
                    <td>
                        ${Auth.hasRole('admin', 'manager') ? `
                            <button class="btn btn-sm btn-success" onclick="Simulation.recoverStuck(${txn.transaction_id}, 'complete')">Complete</button>
                            <button class="btn btn-sm btn-danger" onclick="Simulation.recoverStuck(${txn.transaction_id}, 'fail')">Fail</button>
                        ` : '<span class="text-muted">View Only</span>'}
                    </td>
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="empty-state">
                        <p>No stuck transactions</p>
                        <small>Stuck transactions will appear here for manual recovery</small>
                    </td>
                </tr>
            `;
        }
    },

    // Recover stuck transaction
    async recoverStuck(transactionId, action) {
        const actionText = action === 'complete' ? 'complete' : 'fail';
        Modal.confirm(
            'Recover Transaction',
            `Are you sure you want to ${actionText} this stuck transaction?`,
            async () => {
                const result = await Api.post(`/simulation/recover/${transactionId}`, { action });

                if (result.success) {
                    Toast.success('Success', result.message);
                    this.loadStuckTransactions();
                    this.refreshData();
                } else {
                    Toast.error('Error', result.message);
                }
            },
            Utils.capitalize(actionText),
            action === 'complete' ? 'btn-success' : 'btn-danger'
        );
    },

    // Refresh all data
    refreshData() {
        Dashboard.loadSummary();
        Dashboard.loadRecentActivity();
        Dashboard.loadSystemHealth();

        if (document.getElementById('transactionsPage').classList.contains('active')) {
            Transactions.load();
        }
        if (document.getElementById('accountsPage').classList.contains('active')) {
            Accounts.load();
        }
    }
};
