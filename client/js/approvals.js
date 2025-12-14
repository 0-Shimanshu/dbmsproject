// Approvals module
const Approvals = {
    currentUser: null,

    async init(user) {
        this.currentUser = user || Auth.currentUser;
        
        // Check if user is manager or admin
        if (this.currentUser.role !== 'manager' && this.currentUser.role !== 'admin') {
            document.getElementById('approvalsPage').innerHTML = `
                <div class="card">
                    <div class="card-body">
                        <div class="access-denied">
                            <h2>Access Denied</h2>
                            <p>Only managers and administrators can view approvals.</p>
                        </div>
                    </div>
                </div>
            `;
            return;
        }
        
        this.setupEventListeners();
        await this.loadPendingApprovals();
    },

    setupEventListeners() {
        // Tab switching
        const pendingTab = document.getElementById('pending-approvals-tab');
        const historyTab = document.getElementById('approval-history-tab');
        
        if (pendingTab) {
            pendingTab.addEventListener('click', () => {
                this.setActiveTab('pending');
                this.loadPendingApprovals();
            });
        }
        
        if (historyTab) {
            historyTab.addEventListener('click', () => {
                this.setActiveTab('history');
                this.loadApprovalHistory();
            });
        }
        
        // Refresh button
        const refreshBtn = document.getElementById('refresh-approvals-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                const activeTab = document.querySelector('.tab-btn.active')?.dataset.tab;
                if (activeTab === 'pending') {
                    this.loadPendingApprovals();
                } else {
                    this.loadApprovalHistory();
                }
            });
        }
    },

    setActiveTab(tab) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.getElementById(`${tab}-approvals-tab`)?.classList.add('active');
        
        // Update content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${tab}-approvals-content`)?.classList.add('active');
    },

    async loadPendingApprovals() {
        const container = document.getElementById('pending-approvals-list');
        if (!container) {
            console.error('Container #pending-approvals-list not found!');
            return;
        }
        
        container.innerHTML = '<div class="loading">Loading pending approvals...</div>';
        
        try {
            console.log('Fetching pending approvals from API...');
            const data = await Api.get('/api/approvals/pending');
            console.log('API Response:', data);
            
            if (!data.success) {
                console.error('API returned error:', data);
                container.innerHTML = `<div class="error">${data.message || 'Failed to load approvals'}</div>`;
                Toast.error('Error', data.message || 'Failed to load approvals');
                return;
            }
            
            if (!data.data || data.data.length === 0) {
                container.innerHTML = '<div class="no-data">No pending approvals</div>';
                return;
            }
            
            console.log(`Found ${data.data.length} pending approvals`);
            const html = `
                <div class="table-responsive">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Reference</th>
                                <th>From Account</th>
                                <th>To Account</th>
                                <th>Amount</th>
                                <th>Requested By</th>
                                <th>Date</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.data.map(approval => `
                                <tr>
                                    <td><strong>${approval.reference_number}</strong></td>
                                    <td>
                                        <div>${approval.from_account_number}</div>
                                        <small>${approval.from_holder_name}</small>
                                    </td>
                                    <td>
                                        <div>${approval.to_account_number}</div>
                                        <small>${approval.to_holder_name}</small>
                                    </td>
                                    <td><strong>${Utils.formatCurrency(approval.amount)}</strong></td>
                                    <td>${approval.requested_by_name}</td>
                                    <td>${Utils.formatDateTime(approval.created_at)}</td>
                                    <td>
                                        <button class="btn btn-sm btn-success" onclick="Approvals.approveTransfer(${approval.approval_id})">
                                            Approve
                                        </button>
                                        <button class="btn btn-sm btn-danger" onclick="Approvals.rejectTransfer(${approval.approval_id})">
                                            Reject
                                        </button>
                                    </td>
                                </tr>
                                ${approval.description ? `
                                    <tr class="description-row">
                                        <td colspan="7">
                                            <small><strong>Description:</strong> ${approval.description}</small>
                                        </td>
                                    </tr>
                                ` : ''}
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
            
            container.innerHTML = html;
        } catch (error) {
            console.error('Load pending approvals error:', error);
            container.innerHTML = '<div class="error">Failed to load pending approvals</div>';
            Toast.error('Error', 'Failed to load pending approvals');
        }
    },

    async loadApprovalHistory() {
        const container = document.getElementById('approval-history-list');
        if (!container) return;
        
        container.innerHTML = '<div class="loading">Loading approval history...</div>';
        
        try {
            const data = await Api.get('/api/approvals/history');
            
            if (!data.data || data.data.length === 0) {
                container.innerHTML = '<div class="no-data">No approval history</div>';
                return;
            }
            
            const html = `
                <div class="table-responsive">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Reference</th>
                                <th>From Account</th>
                                <th>To Account</th>
                                <th>Amount</th>
                                <th>Requested By</th>
                                <th>Processed By</th>
                                <th>Status</th>
                                <th>Date</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.data.map(approval => `
                                <tr>
                                    <td><strong>${approval.reference_number}</strong></td>
                                    <td>
                                        <div>${approval.from_account_number}</div>
                                        <small>${approval.from_holder_name}</small>
                                    </td>
                                    <td>
                                        <div>${approval.to_account_number}</div>
                                        <small>${approval.to_holder_name}</small>
                                    </td>
                                    <td><strong>${Utils.formatCurrency(approval.amount)}</strong></td>
                                    <td>${approval.requested_by_name}</td>
                                    <td>${approval.approved_by_name || '-'}</td>
                                    <td>
                                        <span class="badge badge-${approval.status === 'approved' ? 'success' : 'danger'}">
                                            ${approval.status}
                                        </span>
                                    </td>
                                    <td>${Utils.formatDateTime(approval.processed_at)}</td>
                                </tr>
                                ${approval.rejection_reason ? `
                                    <tr class="description-row">
                                        <td colspan="8">
                                            <small><strong>Rejection Reason:</strong> ${approval.rejection_reason}</small>
                                        </td>
                                    </tr>
                                ` : ''}
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
            
            container.innerHTML = html;
        } catch (error) {
            console.error('Load approval history error:', error);
            container.innerHTML = '<div class="error">Failed to load approval history</div>';
            Toast.error('Error', 'Failed to load approval history');
        }
    },

    async approveTransfer(approvalId) {
        if (!confirm('Are you sure you want to approve this transfer?')) {
            return;
        }
        
        try {
            const data = await Api.post(`/api/approvals/${approvalId}/process`, {
                approve: true
            });
            
            Toast.success('Success', data.message || 'Transfer approved successfully');
            await this.loadPendingApprovals();
        } catch (error) {
            console.error('Approve transfer error:', error);
            Toast.error('Error', error.message || 'Failed to approve transfer');
        }
    },

    async rejectTransfer(approvalId) {
        const reason = prompt('Please enter the reason for rejection:');
        if (!reason || reason.trim() === '') {
            Toast.error('Error', 'Rejection reason is required');
            return;
        }
        
        try {
            const data = await Api.post(`/api/approvals/${approvalId}/process`, {
                approve: false,
                rejectionReason: reason
            });
            
            Toast.success('Success', data.message || 'Transfer rejected successfully');
            await this.loadPendingApprovals();
        } catch (error) {
            console.error('Reject transfer error:', error);
            Toast.error('Error', error.message || 'Failed to reject transfer');
        }
    }
};
