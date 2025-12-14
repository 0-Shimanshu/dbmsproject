// Logs Module

const Logs = {
    currentPage: 1,
    pageSize: 50,
    totalPages: 1,

    // Initialize
    async init() {
        await this.loadFilters();
        await this.load();
    },

    // Load filter options
    async loadFilters() {
        // Load action types
        const actionsResult = await Api.get('/logs/actions');
        if (actionsResult.success) {
            const select = document.getElementById('logActionFilter');
            select.innerHTML = '<option value="">All Actions</option>' + 
                actionsResult.data.map(a => `<option value="${Utils.escapeHtml(a)}">${Utils.escapeHtml(a)}</option>`).join('');
        }

        // Load entity types
        const entitiesResult = await Api.get('/logs/entity-types');
        if (entitiesResult.success) {
            const select = document.getElementById('logEntityFilter');
            select.innerHTML = '<option value="">All Entities</option>' + 
                entitiesResult.data.map(e => `<option value="${Utils.escapeHtml(e)}">${Utils.capitalize(e)}</option>`).join('');
        }
    },

    // Load logs
    async load(page = 1) {
        this.currentPage = page;
        const tbody = document.getElementById('logsTableBody');
        Loading.show(tbody, 6);

        const action = document.getElementById('logActionFilter').value;
        const entityType = document.getElementById('logEntityFilter').value;
        const dateFrom = document.getElementById('logDateFrom').value;
        const dateTo = document.getElementById('logDateTo').value;

        let url = `/logs?page=${page}&limit=${this.pageSize}&`;
        if (action) url += `action=${encodeURIComponent(action)}&`;
        if (entityType) url += `entityType=${encodeURIComponent(entityType)}&`;
        if (dateFrom) url += `dateFrom=${dateFrom}&`;
        if (dateTo) url += `dateTo=${dateTo}&`;

        const result = await Api.get(url);

        if (result.success && result.data.length > 0) {
            tbody.innerHTML = result.data.map(log => `
                <tr>
                    <td>${Utils.formatDateTime(log.created_at)}</td>
                    <td>${Utils.escapeHtml(log.actor_name || 'System')}</td>
                    <td>${log.actor_role ? Utils.getStatusBadge(log.actor_role) : '-'}</td>
                    <td><code>${Utils.escapeHtml(log.action)}</code></td>
                    <td>${Utils.capitalize(log.entity_type)} ${log.entity_id ? `#${log.entity_id}` : ''}</td>
                    <td>${Utils.truncate(log.reason || '-', 40)}</td>
                </tr>
            `).join('');

            // Update pagination
            if (result.pagination) {
                this.totalPages = result.pagination.totalPages;
                this.renderPagination();
            }
        } else {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="empty-state">
                        <p>No audit logs found</p>
                        <small>Logs are automatically generated when actions are performed in the system</small>
                    </td>
                </tr>
            `;
            document.getElementById('logsPagination').innerHTML = '';
        }
    },

    // Render pagination
    renderPagination() {
        const container = document.getElementById('logsPagination');
        
        if (this.totalPages <= 1) {
            container.innerHTML = '';
            return;
        }

        let html = '';

        // Previous button
        html += `<button ${this.currentPage === 1 ? 'disabled' : ''} onclick="Logs.load(${this.currentPage - 1})">← Prev</button>`;

        // Page numbers
        const startPage = Math.max(1, this.currentPage - 2);
        const endPage = Math.min(this.totalPages, this.currentPage + 2);

        if (startPage > 1) {
            html += `<button onclick="Logs.load(1)">1</button>`;
            if (startPage > 2) html += `<span>...</span>`;
        }

        for (let i = startPage; i <= endPage; i++) {
            html += `<button class="${i === this.currentPage ? 'active' : ''}" onclick="Logs.load(${i})">${i}</button>`;
        }

        if (endPage < this.totalPages) {
            if (endPage < this.totalPages - 1) html += `<span>...</span>`;
            html += `<button onclick="Logs.load(${this.totalPages})">${this.totalPages}</button>`;
        }

        // Next button
        html += `<button ${this.currentPage === this.totalPages ? 'disabled' : ''} onclick="Logs.load(${this.currentPage + 1})">Next →</button>`;

        container.innerHTML = html;
    }
};
