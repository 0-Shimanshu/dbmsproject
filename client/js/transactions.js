// Transactions Module

const Transactions = {
    accounts: [],

    // Initialize
    async init() {
        await this.loadAccounts();
        await this.load();
    },

    // Load active accounts for dropdowns
    async loadAccounts() {
        const result = await Api.get('/accounts?status=active');
        if (result.success) {
            this.accounts = result.data;
        }
    },

    // Load transactions
    async load() {
        const tbody = document.getElementById('transactionsTableBody');
        Loading.show(tbody, 8);

        const status = document.getElementById('txnStatusFilter').value;
        const type = document.getElementById('txnTypeFilter').value;
        const dateFrom = document.getElementById('txnDateFrom').value;
        const dateTo = document.getElementById('txnDateTo').value;

        let url = '/transactions?';
        if (status) url += `status=${status}&`;
        if (type) url += `type=${type}&`;
        if (dateFrom) url += `dateFrom=${dateFrom}&`;
        if (dateTo) url += `dateTo=${dateTo}&`;

        const result = await Api.get(url);

        if (result.success && result.data.length > 0) {
            tbody.innerHTML = result.data.map(txn => `
                <tr>
                    <td><code>${Utils.escapeHtml(txn.reference_number)}</code></td>
                    <td>${txn.from_account ? `${Utils.escapeHtml(txn.from_account)}<br><small>${Utils.escapeHtml(txn.from_holder_first || '')} ${Utils.escapeHtml(txn.from_holder_last || '')}</small>` : '-'}</td>
                    <td>${txn.to_account ? `${Utils.escapeHtml(txn.to_account)}<br><small>${Utils.escapeHtml(txn.to_holder_first || '')} ${Utils.escapeHtml(txn.to_holder_last || '')}</small>` : '-'}</td>
                    <td>${Utils.capitalize(txn.transaction_type)}</td>
                    <td>${Utils.formatCurrency(txn.amount)}</td>
                    <td>${Utils.getStatusBadge(txn.status)}</td>
                    <td>${Utils.formatRelativeTime(txn.created_at)}</td>
                    <td>
                        <button class="btn btn-sm btn-outline" onclick="Transactions.showDetails(${txn.transaction_id})">Details</button>
                    </td>
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="empty-state">
                        <p>No transactions found</p>
                        ${Auth.hasRole('admin', 'manager', 'teller') ? 
                            '<button class="btn btn-primary btn-sm" onclick="App.navigateTo(\'simulation\')">Run Simulation</button>' : ''}
                    </td>
                </tr>
            `;
        }
    },

    // Show transaction details
    async showDetails(transactionId) {
        const result = await Api.get(`/transactions/${transactionId}`);

        if (!result.success) {
            Toast.error('Error', result.message);
            return;
        }

        const txn = result.data;
        const history = txn.history || [];

        const timelineHtml = history.map((h, i) => `
            <div class="timeline-item ${h.to_state}">
                <div class="timeline-time">${Utils.formatDateTime(h.created_at)}</div>
                <div class="timeline-content">
                    <div class="timeline-title">${Utils.capitalize(h.from_state || 'Init')} → ${Utils.capitalize(h.to_state)}</div>
                    <div class="timeline-description">${Utils.escapeHtml(h.reason || '')}</div>
                    ${h.changed_by_name ? `<small>By: ${Utils.escapeHtml(h.changed_by_name)}</small>` : ''}
                </div>
            </div>
        `).join('');

        const html = `
            <div class="modal-header">
                <h3>Transaction Details</h3>
                <button class="modal-close" onclick="Modal.close()">×</button>
            </div>
            <div class="modal-body">
                <div class="account-details">
                    <div class="detail-row">
                        <span class="detail-label">Reference</span>
                        <span class="detail-value"><code>${Utils.escapeHtml(txn.reference_number)}</code></span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Type</span>
                        <span class="detail-value">${Utils.capitalize(txn.transaction_type)}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Amount</span>
                        <span class="detail-value"><strong>${Utils.formatCurrency(txn.amount)}</strong></span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">From Account</span>
                        <span class="detail-value">${txn.from_account || '-'}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">To Account</span>
                        <span class="detail-value">${txn.to_account || '-'}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Status</span>
                        <span class="detail-value">${Utils.getStatusBadge(txn.status)}</span>
                    </div>
                    ${txn.failure_reason ? `
                        <div class="detail-row">
                            <span class="detail-label">Failure Reason</span>
                            <span class="detail-value text-danger">${Utils.escapeHtml(txn.failure_reason)}</span>
                        </div>
                    ` : ''}
                    <div class="detail-row">
                        <span class="detail-label">Initiated By</span>
                        <span class="detail-value">${Utils.escapeHtml(txn.initiated_by_name || '-')}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Created At</span>
                        <span class="detail-value">${Utils.formatDateTime(txn.created_at)}</span>
                    </div>
                    ${txn.completed_at ? `
                        <div class="detail-row">
                            <span class="detail-label">Completed At</span>
                            <span class="detail-value">${Utils.formatDateTime(txn.completed_at)}</span>
                        </div>
                    ` : ''}
                </div>

                ${history.length > 0 ? `
                    <h4 style="margin-top: 20px; margin-bottom: 16px;">Transaction Lifecycle</h4>
                    <div class="timeline">
                        ${timelineHtml}
                    </div>
                ` : ''}
            </div>
            <div class="modal-footer">
                <button class="btn btn-outline" onclick="Modal.close()">Close</button>
            </div>
        `;

        Modal.open(html);
    },

    // Get account options HTML
    getAccountOptions(selectedId = null) {
        return this.accounts.map(acc => 
            `<option value="${acc.account_id}" ${acc.account_id == selectedId ? 'selected' : ''}>
                ${Utils.escapeHtml(acc.account_number)} - ${Utils.escapeHtml(acc.holder_name)} (${Utils.formatCurrency(acc.available_balance)})
            </option>`
        ).join('');
    },

    // Show deposit modal
    showDepositModal() {
        const html = `
            <div class="modal-header">
                <h3>Make Deposit</h3>
                <button class="modal-close" onclick="Modal.close()">×</button>
            </div>
            <div class="modal-body">
                <form id="depositForm">
                    <div class="form-group">
                        <label for="depositAccount">Account *</label>
                        <select id="depositAccount" class="form-control" required>
                            <option value="">Select account...</option>
                            ${this.getAccountOptions()}
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="depositAmount">Amount *</label>
                        <input type="number" id="depositAmount" class="form-control" min="0.01" step="0.01" required placeholder="0.00">
                    </div>
                    <div class="form-group">
                        <label for="depositDescription">Description</label>
                        <input type="text" id="depositDescription" class="form-control" placeholder="Cash deposit">
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button class="btn btn-outline" onclick="Modal.close()">Cancel</button>
                <button class="btn btn-success" onclick="Transactions.processDeposit()">Deposit</button>
            </div>
        `;

        Modal.open(html);
    },

    // Process deposit
    async processDeposit() {
        const accountId = document.getElementById('depositAccount').value;
        const amount = parseFloat(document.getElementById('depositAmount').value);
        const description = document.getElementById('depositDescription').value;

        if (!accountId || !amount) {
            Toast.error('Error', 'Please fill in all required fields');
            return;
        }

        const result = await Api.post('/transactions/deposit', {
            accountId: parseInt(accountId),
            amount,
            description
        });

        if (result.success) {
            Toast.success('Success', `Deposit of ${Utils.formatCurrency(amount)} completed`);
            Modal.close();
            this.load();
            Accounts.load();
            Dashboard.loadSummary();
        } else {
            Toast.error('Error', result.message);
        }
    },

    // Show withdraw modal
    showWithdrawModal() {
        const html = `
            <div class="modal-header">
                <h3>Make Withdrawal</h3>
                <button class="modal-close" onclick="Modal.close()">×</button>
            </div>
            <div class="modal-body">
                <form id="withdrawForm">
                    <div class="form-group">
                        <label for="withdrawAccount">Account *</label>
                        <select id="withdrawAccount" class="form-control" required>
                            <option value="">Select account...</option>
                            ${this.getAccountOptions()}
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="withdrawAmount">Amount *</label>
                        <input type="number" id="withdrawAmount" class="form-control" min="0.01" step="0.01" required placeholder="0.00">
                    </div>
                    <div class="form-group">
                        <label for="withdrawDescription">Description</label>
                        <input type="text" id="withdrawDescription" class="form-control" placeholder="Cash withdrawal">
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button class="btn btn-outline" onclick="Modal.close()">Cancel</button>
                <button class="btn btn-warning" onclick="Transactions.processWithdraw()">Withdraw</button>
            </div>
        `;

        Modal.open(html);
    },

    // Process withdrawal
    async processWithdraw() {
        const accountId = document.getElementById('withdrawAccount').value;
        const amount = parseFloat(document.getElementById('withdrawAmount').value);
        const description = document.getElementById('withdrawDescription').value;

        if (!accountId || !amount) {
            Toast.error('Error', 'Please fill in all required fields');
            return;
        }

        const result = await Api.post('/transactions/withdraw', {
            accountId: parseInt(accountId),
            amount,
            description
        });

        if (result.success) {
            Toast.success('Success', `Withdrawal of ${Utils.formatCurrency(amount)} completed`);
            Modal.close();
            this.load();
            Accounts.load();
            Dashboard.loadSummary();
        } else {
            Toast.error('Error', result.message);
        }
    },

    // Show transfer modal
    showTransferModal() {
        const html = `
            <div class="modal-header">
                <h3>Make Transfer</h3>
                <button class="modal-close" onclick="Modal.close()">×</button>
            </div>
            <div class="modal-body">
                <form id="transferForm">
                    <div class="form-group">
                        <label for="transferFromAccount">From Account *</label>
                        <select id="transferFromAccount" class="form-control" required>
                            <option value="">Select source account...</option>
                            ${this.getAccountOptions()}
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="transferToAccount">To Account *</label>
                        <select id="transferToAccount" class="form-control" required>
                            <option value="">Select destination account...</option>
                            ${this.getAccountOptions()}
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="transferAmount">Amount *</label>
                        <input type="number" id="transferAmount" class="form-control" min="0.01" step="0.01" required placeholder="0.00">
                    </div>
                    <div class="form-group">
                        <label for="transferDescription">Description</label>
                        <input type="text" id="transferDescription" class="form-control" placeholder="Fund transfer">
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button class="btn btn-outline" onclick="Modal.close()">Cancel</button>
                <button class="btn btn-info" onclick="Transactions.processTransfer()">Transfer</button>
            </div>
        `;

        Modal.open(html);
    },

    // Process transfer
    async processTransfer() {
        const fromAccountId = document.getElementById('transferFromAccount').value;
        const toAccountId = document.getElementById('transferToAccount').value;
        const amount = parseFloat(document.getElementById('transferAmount').value);
        const description = document.getElementById('transferDescription').value;

        if (!fromAccountId || !toAccountId || !amount) {
            Toast.error('Error', 'Please fill in all required fields');
            return;
        }

        if (fromAccountId === toAccountId) {
            Toast.error('Error', 'Cannot transfer to the same account');
            return;
        }

        const result = await Api.post('/transactions/transfer', {
            fromAccountId: parseInt(fromAccountId),
            toAccountId: parseInt(toAccountId),
            amount,
            description
        });

        if (result.success) {
            Toast.success('Success', `Transfer of ${Utils.formatCurrency(amount)} completed`);
            Modal.close();
            this.load();
            Accounts.load();
            Dashboard.loadSummary();
        } else {
            Toast.error('Error', result.message);
        }
    }
};
