// Dashboard Module

const Dashboard = {
    refreshInterval: null,

    // Initialize dashboard
    async init() {
        await this.loadSummary();
        await this.loadRecentActivity();
        await this.loadSystemHealth();

        // Auto-refresh every 30 seconds
        this.startAutoRefresh();
    },

    // Start auto-refresh
    startAutoRefresh() {
        this.stopAutoRefresh();
        this.refreshInterval = setInterval(() => {
            if (document.getElementById('dashboardPage').classList.contains('active')) {
                this.loadSummary();
                this.loadRecentActivity();
                this.loadSystemHealth();
            }
        }, 30000);
    },

    // Stop auto-refresh
    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    },

    // Load summary data
    async loadSummary() {
        const result = await Api.get('/dashboard/summary');

        if (result.success) {
            const data = result.data;
            document.getElementById('totalAccounts').textContent = data.total_active_accounts || 0;
            document.getElementById('pendingTransactions').textContent = data.pending_transactions || 0;
            document.getElementById('failedToday').textContent = data.failed_today || 0;
            document.getElementById('frozenAccounts').textContent = data.frozen_accounts || 0;
            document.getElementById('completedToday').textContent = data.completed_today || 0;
            document.getElementById('volumeToday').textContent = Utils.formatCurrency(data.total_volume_today);
            document.getElementById('stuckTransactions').textContent = data.stuck_transactions || 0;
            document.getElementById('pendingReversals').textContent = data.pending_reversals || 0;
            
            // Show pending approvals card only for managers and admins
            const currentUser = Auth.getCurrentUser();
            if (currentUser && (currentUser.role === 'manager' || currentUser.role === 'admin')) {
                const approvalsCard = document.getElementById('pendingApprovalsCard');
                if (approvalsCard) {
                    approvalsCard.style.display = 'block';
                    document.getElementById('pendingApprovals').textContent = data.pending_approvals || 0;
                }
            }
        }
    },

    // Load recent activity
    async loadRecentActivity() {
        const tbody = document.getElementById('recentActivityTable');
        Loading.show(tbody, 6);

        const result = await Api.get('/dashboard/recent-activity');

        if (result.success && result.data.length > 0) {
            tbody.innerHTML = result.data.map(activity => `
                <tr>
                    <td>${Utils.capitalize(activity.activity_type)}</td>
                    <td><code>${Utils.escapeHtml(activity.reference || '-')}</code></td>
                    <td>${Utils.truncate(activity.description, 40)}</td>
                    <td>${Utils.formatCurrency(activity.amount)}</td>
                    <td>${Utils.getStatusBadge(activity.status)}</td>
                    <td>${Utils.formatRelativeTime(activity.created_at)}</td>
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="empty-state">
                        <p>No recent activity</p>
                        <button class="btn btn-primary btn-sm" onclick="App.navigateTo('simulation')">Run Simulation</button>
                    </td>
                </tr>
            `;
        }
    },

    // Load system health
    async loadSystemHealth() {
        const result = await Api.get('/dashboard/system-health');

        if (result.success) {
            const data = result.data;

            // Update health indicators
            const dbHealth = document.getElementById('dbHealth');
            dbHealth.textContent = Utils.capitalize(data.database);
            dbHealth.className = `health-status ${data.database}`;

            const stuckHealth = document.getElementById('stuckHealth');
            stuckHealth.textContent = data.stuckTransactions;
            stuckHealth.className = `health-status ${data.stuckTransactions > 0 ? 'warning' : 'healthy'}`;

            const stalePending = document.getElementById('stalePendingHealth');
            stalePending.textContent = data.stalePendingTransactions;
            stalePending.className = `health-status ${data.stalePendingTransactions > 0 ? 'warning' : 'healthy'}`;

            const overallHealth = document.getElementById('overallHealth');
            overallHealth.textContent = Utils.capitalize(data.overallStatus);
            overallHealth.className = `health-status ${data.overallStatus}`;

            // Update header status
            const statusDot = document.querySelector('.system-status .status-dot');
            const statusText = document.querySelector('.system-status .status-text');
            statusDot.className = `status-dot ${data.overallStatus === 'healthy' ? '' : data.overallStatus}`;
            statusText.textContent = `System ${Utils.capitalize(data.overallStatus)}`;
        }
    }
};
