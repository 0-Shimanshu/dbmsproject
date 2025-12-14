// Reports Module

const Reports = {
    charts: {},

    // Initialize
    async init() {
        await this.loadDailyVolume();
        await this.loadSuccessRate();
        await this.loadByType();
        await this.loadAccountStats();
        await this.loadTopAccounts();
    },

    // Load daily transaction volume chart
    async loadDailyVolume() {
        const result = await Api.get('/reports/daily-stats?days=14');

        if (result.success && result.data.length > 0) {
            const labels = result.data.map(d => Utils.formatDate(d.transaction_date));
            const completed = result.data.map(d => d.completed_count);
            const failed = result.data.map(d => d.failed_count);
            const pending = result.data.map(d => d.pending_count);

            const ctx = document.getElementById('dailyVolumeChart').getContext('2d');

            if (this.charts.dailyVolume) {
                this.charts.dailyVolume.destroy();
            }

            this.charts.dailyVolume = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels,
                    datasets: [
                        {
                            label: 'Completed',
                            data: completed,
                            backgroundColor: 'rgba(52, 168, 83, 0.8)',
                            borderColor: 'rgba(52, 168, 83, 1)',
                            borderWidth: 1
                        },
                        {
                            label: 'Failed',
                            data: failed,
                            backgroundColor: 'rgba(234, 67, 53, 0.8)',
                            borderColor: 'rgba(234, 67, 53, 1)',
                            borderWidth: 1
                        },
                        {
                            label: 'Pending',
                            data: pending,
                            backgroundColor: 'rgba(251, 188, 4, 0.8)',
                            borderColor: 'rgba(251, 188, 4, 1)',
                            borderWidth: 1
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: { stacked: true },
                        y: { stacked: true, beginAtZero: true }
                    },
                    plugins: {
                        legend: { position: 'bottom' }
                    }
                }
            });
        }
    },

    // Load success rate chart
    async loadSuccessRate() {
        const result = await Api.get('/reports/success-rate');

        if (result.success && result.data.length > 0) {
            const labels = result.data.map(d => Utils.formatDate(d.date));
            const successRate = result.data.map(d => d.success_rate);

            const ctx = document.getElementById('successRateChart').getContext('2d');

            if (this.charts.successRate) {
                this.charts.successRate.destroy();
            }

            this.charts.successRate = new Chart(ctx, {
                type: 'line',
                data: {
                    labels,
                    datasets: [{
                        label: 'Success Rate (%)',
                        data: successRate,
                        fill: true,
                        backgroundColor: 'rgba(52, 168, 83, 0.1)',
                        borderColor: 'rgba(52, 168, 83, 1)',
                        tension: 0.4,
                        pointBackgroundColor: 'rgba(52, 168, 83, 1)'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            max: 100,
                            ticks: {
                                callback: value => value + '%'
                            }
                        }
                    },
                    plugins: {
                        legend: { position: 'bottom' }
                    }
                }
            });
        }
    },

    // Load transactions by type chart
    async loadByType() {
        const result = await Api.get('/reports/by-type');

        if (result.success && result.data.length > 0) {
            const labels = result.data.map(d => Utils.capitalize(d.transaction_type));
            const counts = result.data.map(d => d.count);

            const ctx = document.getElementById('txnTypeChart').getContext('2d');

            if (this.charts.txnType) {
                this.charts.txnType.destroy();
            }

            this.charts.txnType = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels,
                    datasets: [{
                        data: counts,
                        backgroundColor: [
                            'rgba(26, 115, 232, 0.8)',
                            'rgba(52, 168, 83, 0.8)',
                            'rgba(251, 188, 4, 0.8)',
                            'rgba(234, 67, 53, 0.8)',
                            'rgba(95, 99, 104, 0.8)',
                            'rgba(66, 133, 244, 0.8)'
                        ],
                        borderWidth: 2,
                        borderColor: '#fff'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'bottom' }
                    }
                }
            });
        }
    },

    // Load account statistics
    async loadAccountStats() {
        const result = await Api.get('/reports/accounts');
        const container = document.getElementById('accountStats');

        if (result.success) {
            const totals = result.data.totals;

            container.innerHTML = `
                <div class="account-stats-grid">
                    <div class="account-stat-card">
                        <div class="account-stat-value">${totals.total_accounts}</div>
                        <div class="account-stat-label">Total Accounts</div>
                    </div>
                    <div class="account-stat-card">
                        <div class="account-stat-value">${Utils.formatCurrency(totals.total_balance)}</div>
                        <div class="account-stat-label">Total Balance</div>
                    </div>
                    <div class="account-stat-card">
                        <div class="account-stat-value">${Utils.formatCurrency(totals.total_held)}</div>
                        <div class="account-stat-label">Total Held</div>
                    </div>
                    <div class="account-stat-card">
                        <div class="account-stat-value">${Utils.formatCurrency(totals.avg_balance)}</div>
                        <div class="account-stat-label">Average Balance</div>
                    </div>
                </div>
            `;
        } else {
            container.innerHTML = '<div class="empty-state">Failed to load statistics</div>';
        }
    },

    // Load top accounts
    async loadTopAccounts() {
        const tbody = document.getElementById('topAccountsTableBody');
        Loading.show(tbody, 6);

        const result = await Api.get('/reports/top-accounts');

        if (result.success && result.data.length > 0) {
            tbody.innerHTML = result.data.map((acc, i) => `
                <tr>
                    <td><code>${Utils.escapeHtml(acc.account_number)}</code></td>
                    <td>${Utils.escapeHtml(acc.holder_name)}</td>
                    <td>${Utils.capitalize(acc.account_type.replace('_', ' '))}</td>
                    <td>${Utils.formatCurrency(acc.balance)}</td>
                    <td>${acc.transaction_count}</td>
                    <td><strong>${Utils.formatCurrency(acc.total_volume)}</strong></td>
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="empty-state">
                        <p>No transaction data available</p>
                        <small>Transaction data from the last 30 days will appear here</small>
                    </td>
                </tr>
            `;
        }
    }
};
