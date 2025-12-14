// Accounts Module

const Accounts = {
    holders: [],

    // Initialize
    async init() {
        await this.load();
        await this.loadHolders();
    },

    // Load accounts
    async load() {
        const tbody = document.getElementById('accountsTableBody');
        Loading.show(tbody, 7);

        const status = document.getElementById('accountStatusFilter').value;
        const type = document.getElementById('accountTypeFilter').value;
        const search = document.getElementById('accountSearch').value;

        let url = '/accounts?';
        if (status) url += `status=${status}&`;
        if (type) url += `type=${type}&`;
        if (search) url += `search=${encodeURIComponent(search)}&`;

        const result = await Api.get(url);

        if (result.success && result.data.length > 0) {
            tbody.innerHTML = result.data.map(account => `
                <tr>
                    <td><code>${Utils.escapeHtml(account.account_number)}</code></td>
                    <td>${Utils.escapeHtml(account.holder_name)}</td>
                    <td>${Utils.capitalize(account.account_type.replace('_', ' '))}</td>
                    <td>${Utils.formatCurrency(account.balance)}</td>
                    <td>${Utils.formatCurrency(account.available_balance)}</td>
                    <td>${Utils.getStatusBadge(account.status)}</td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn btn-sm btn-outline" onclick="Accounts.showDetails(${account.account_id})">View</button>
                            ${account.status === 'active' && Auth.hasRole('admin', 'manager') ? 
                                `<button class="btn btn-sm btn-warning" onclick="Accounts.showFreezeModal(${account.account_id}, '${Utils.escapeHtml(account.account_number)}')">Freeze</button>` : ''}
                            ${account.status === 'frozen' && Auth.hasRole('admin', 'manager') ? 
                                `<button class="btn btn-sm btn-success" onclick="Accounts.showUnfreezeModal(${account.account_id}, '${Utils.escapeHtml(account.account_number)}')">Unfreeze</button>` : ''}
                        </div>
                    </td>
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="empty-state">
                        <p>No accounts found</p>
                        ${Auth.hasRole('admin', 'manager', 'teller') ? 
                            '<button class="btn btn-primary btn-sm" onclick="Accounts.showCreateModal()">Create Account</button>' : ''}
                    </td>
                </tr>
            `;
        }
    },

    // Load account holders
    async loadHolders() {
        const result = await Api.get('/accounts/holders/list');
        if (result.success) {
            this.holders = result.data;
        }
    },

    // Show account details
    async showDetails(accountId) {
        const result = await Api.get(`/accounts/${accountId}`);

        if (!result.success) {
            Toast.error('Error', result.message);
            return;
        }

        const account = result.data;
        const html = `
            <div class="modal-header">
                <h3>Account Details</h3>
                <button class="modal-close" onclick="Modal.close()">×</button>
            </div>
            <div class="modal-body">
                <div class="account-details">
                    <div class="detail-row">
                        <span class="detail-label">Account Number</span>
                        <span class="detail-value"><code>${Utils.escapeHtml(account.account_number)}</code></span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Holder Name</span>
                        <span class="detail-value">${Utils.escapeHtml(account.holder_name)}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Email</span>
                        <span class="detail-value">${Utils.escapeHtml(account.holder_email || '-')}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Phone</span>
                        <span class="detail-value">${Utils.escapeHtml(account.holder_phone || '-')}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Account Type</span>
                        <span class="detail-value">${Utils.capitalize(account.account_type.replace('_', ' '))}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Balance</span>
                        <span class="detail-value">${Utils.formatCurrency(account.balance)}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Held Balance</span>
                        <span class="detail-value">${Utils.formatCurrency(account.held_balance)}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Available Balance</span>
                        <span class="detail-value"><strong>${Utils.formatCurrency(account.available_balance)}</strong></span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Status</span>
                        <span class="detail-value">${Utils.getStatusBadge(account.status)}</span>
                    </div>
                    ${account.status === 'frozen' ? `
                        <div class="detail-row">
                            <span class="detail-label">Freeze Reason</span>
                            <span class="detail-value text-danger">${Utils.escapeHtml(account.freeze_reason || '-')}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Frozen At</span>
                            <span class="detail-value">${Utils.formatDateTime(account.frozen_at)}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Frozen By</span>
                            <span class="detail-value">${Utils.escapeHtml(account.frozen_by_name || '-')}</span>
                        </div>
                    ` : ''}
                    <div class="detail-row">
                        <span class="detail-label">Created At</span>
                        <span class="detail-value">${Utils.formatDateTime(account.created_at)}</span>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-outline" onclick="Modal.close()">Close</button>
            </div>
        `;

        Modal.open(html);
    },

    // Show create account modal
    showCreateModal() {
        const holdersOptions = this.holders.map(h => 
            `<option value="${h.holder_id}">${Utils.escapeHtml(h.first_name)} ${Utils.escapeHtml(h.last_name)} (${Utils.escapeHtml(h.id_number)})</option>`
        ).join('');

        const html = `
            <div class="modal-header">
                <h3>Create New Account</h3>
                <button class="modal-close" onclick="Modal.close()">×</button>
            </div>
            <div class="modal-body">
                <form id="createAccountForm">
                    <div class="form-group">
                        <label for="holderId">Account Holder *</label>
                        <select id="holderId" class="form-control" required>
                            <option value="">Select holder...</option>
                            ${holdersOptions}
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="accountType">Account Type *</label>
                        <select id="accountType" class="form-control" required>
                            <option value="savings">Savings</option>
                            <option value="checking">Checking</option>
                            <option value="business">Business</option>
                            <option value="fixed_deposit">Fixed Deposit</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="initialDeposit">Initial Deposit</label>
                        <input type="number" id="initialDeposit" class="form-control" min="0" step="0.01" value="0">
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button class="btn btn-outline" onclick="Modal.close()">Cancel</button>
                <button class="btn btn-primary" onclick="Accounts.create()">Create Account</button>
            </div>
        `;

        Modal.open(html);
    },

    // Create account
    async create() {
        const holderId = document.getElementById('holderId').value;
        const accountType = document.getElementById('accountType').value;
        const initialDeposit = parseFloat(document.getElementById('initialDeposit').value) || 0;

        if (!holderId) {
            Toast.error('Error', 'Please select an account holder');
            return;
        }

        const result = await Api.post('/accounts', {
            holderId: parseInt(holderId),
            accountType,
            initialDeposit
        });

        if (result.success) {
            Toast.success('Success', `Account ${result.data.accountNumber} created successfully`);
            Modal.close();
            this.load();
        } else {
            Toast.error('Error', result.message);
        }
    },

    // Show freeze modal
    showFreezeModal(accountId, accountNumber) {
        const html = `
            <div class="modal-header">
                <h3>Freeze Account</h3>
                <button class="modal-close" onclick="Modal.close()">×</button>
            </div>
            <div class="modal-body">
                <p>You are about to freeze account <strong>${Utils.escapeHtml(accountNumber)}</strong>.</p>
                <div class="form-group">
                    <label for="freezeReason">Reason (Required) *</label>
                    <textarea id="freezeReason" class="form-control" rows="3" required placeholder="Enter reason for freezing this account..."></textarea>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-outline" onclick="Modal.close()">Cancel</button>
                <button class="btn btn-warning" onclick="Accounts.freeze(${accountId})">Freeze Account</button>
            </div>
        `;

        Modal.open(html);
    },

    // Freeze account
    async freeze(accountId) {
        const reason = document.getElementById('freezeReason').value.trim();

        if (!reason) {
            Toast.error('Error', 'Freeze reason is required');
            return;
        }

        const result = await Api.post(`/accounts/${accountId}/freeze`, { reason });

        if (result.success) {
            Toast.success('Success', result.message);
            Modal.close();
            this.load();
            Dashboard.loadSummary();
        } else {
            Toast.error('Error', result.message);
        }
    },

    // Show unfreeze modal
    showUnfreezeModal(accountId, accountNumber) {
        const html = `
            <div class="modal-header">
                <h3>Unfreeze Account</h3>
                <button class="modal-close" onclick="Modal.close()">×</button>
            </div>
            <div class="modal-body">
                <p>You are about to unfreeze account <strong>${Utils.escapeHtml(accountNumber)}</strong>.</p>
                <div class="form-group">
                    <label for="unfreezeReason">Reason (Required) *</label>
                    <textarea id="unfreezeReason" class="form-control" rows="3" required placeholder="Enter reason for unfreezing this account..."></textarea>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-outline" onclick="Modal.close()">Cancel</button>
                <button class="btn btn-success" onclick="Accounts.unfreeze(${accountId})">Unfreeze Account</button>
            </div>
        `;

        Modal.open(html);
    },

    // Unfreeze account
    async unfreeze(accountId) {
        const reason = document.getElementById('unfreezeReason').value.trim();

        if (!reason) {
            Toast.error('Error', 'Unfreeze reason is required');
            return;
        }

        const result = await Api.post(`/accounts/${accountId}/unfreeze`, { reason });

        if (result.success) {
            Toast.success('Success', result.message);
            Modal.close();
            this.load();
            Dashboard.loadSummary();
        } else {
            Toast.error('Error', result.message);
        }
    }
};

// Add styles for detail rows
const detailStyles = document.createElement('style');
detailStyles.textContent = `
    .detail-row {
        display: flex;
        justify-content: space-between;
        padding: 10px 0;
        border-bottom: 1px solid var(--border-color);
    }
    .detail-row:last-child {
        border-bottom: none;
    }
    .detail-label {
        color: var(--text-secondary);
    }
    .detail-value {
        font-weight: 500;
        text-align: right;
    }
`;
document.head.appendChild(detailStyles);
