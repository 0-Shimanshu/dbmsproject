// Reversals Module

const Reversals = {
    // Initialize
    async init() {
        await this.loadReversible();
        await this.loadHistory();
    },

    // Load reversible transactions
    async loadReversible() {
        const tbody = document.getElementById('reversibleTableBody');
        Loading.show(tbody, 7);

        const result = await Api.get('/reversals/reversible');

        if (result.success && result.data.length > 0) {
            tbody.innerHTML = result.data.map(txn => `
                <tr>
                    <td><code>${Utils.escapeHtml(txn.reference_number)}</code></td>
                    <td>${txn.from_account ? `${Utils.escapeHtml(txn.from_account)}<br><small>${Utils.escapeHtml(txn.from_holder || '')}</small>` : '-'}</td>
                    <td>${txn.to_account ? `${Utils.escapeHtml(txn.to_account)}<br><small>${Utils.escapeHtml(txn.to_holder || '')}</small>` : '-'}</td>
                    <td>${Utils.capitalize(txn.transaction_type)}</td>
                    <td>${Utils.formatCurrency(txn.amount)}</td>
                    <td>${Utils.formatRelativeTime(txn.completed_at)}</td>
                    <td>
                        ${Auth.hasRole('admin', 'manager') ? 
                            `<button class="btn btn-sm btn-warning" onclick="Reversals.showReversalModal(${txn.transaction_id}, '${Utils.escapeHtml(txn.reference_number)}', ${txn.amount})">Reverse</button>` 
                            : '<span class="text-muted">View Only</span>'}
                    </td>
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="empty-state">
                        <p>No reversible transactions available</p>
                        <small>Only completed transactions within the last 24 hours can be reversed</small>
                    </td>
                </tr>
            `;
        }
    },

    // Load reversal history
    async loadHistory() {
        const tbody = document.getElementById('reversalHistoryTableBody');
        Loading.show(tbody, 7);

        const status = document.getElementById('reversalStatusFilter').value;
        let url = '/reversals?';
        if (status) url += `status=${status}&`;

        const result = await Api.get(url);

        if (result.success && result.data.length > 0) {
            tbody.innerHTML = result.data.map(rev => `
                <tr>
                    <td><code>${Utils.escapeHtml(rev.original_reference)}</code></td>
                    <td>${Utils.formatCurrency(rev.amount)}</td>
                    <td>${Utils.capitalize(rev.transaction_type)}</td>
                    <td>${Utils.truncate(rev.reason, 30)}</td>
                    <td>${Utils.escapeHtml(rev.requested_by_name || '-')}</td>
                    <td>${Utils.getStatusBadge(rev.status)}</td>
                    <td>${Utils.formatRelativeTime(rev.created_at)}</td>
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="empty-state">
                        <p>No reversal history</p>
                    </td>
                </tr>
            `;
        }
    },

    // Show reversal modal
    showReversalModal(transactionId, reference, amount) {
        const html = `
            <div class="modal-header">
                <h3>Reverse Transaction</h3>
                <button class="modal-close" onclick="Modal.close()">×</button>
            </div>
            <div class="modal-body">
                <div class="alert alert-warning">
                    <strong>Warning:</strong> This action will reverse the transaction and refund the amount.
                </div>
                <p>You are about to reverse transaction:</p>
                <ul>
                    <li><strong>Reference:</strong> ${Utils.escapeHtml(reference)}</li>
                    <li><strong>Amount:</strong> ${Utils.formatCurrency(amount)}</li>
                </ul>
                <div class="form-group">
                    <label for="reversalReason">Reason (Required) *</label>
                    <textarea id="reversalReason" class="form-control" rows="3" required placeholder="Enter reason for reversal..."></textarea>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-outline" onclick="Modal.close()">Cancel</button>
                <button class="btn btn-warning" onclick="Reversals.process(${transactionId})">Confirm Reversal</button>
            </div>
        `;

        Modal.open(html);
    },

    // Process reversal
    async process(transactionId) {
        const reason = document.getElementById('reversalReason').value.trim();

        if (!reason) {
            Toast.error('Error', 'Reversal reason is required');
            return;
        }

        const result = await Api.post('/reversals', {
            transactionId,
            reason
        });

        if (result.success) {
            Toast.success('Success', 'Transaction reversed successfully');
            Modal.close();
            this.loadReversible();
            this.loadHistory();
            Accounts.load();
            Transactions.load();
            Dashboard.loadSummary();
        } else {
            Toast.error('Error', result.message);
        }
    }
};
