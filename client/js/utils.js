// Utility Functions

const Utils = {
    // Format currency
    formatCurrency(amount) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount || 0);
    },

    // Format date
    formatDate(dateString) {
        if (!dateString) return '-';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    },

    // Format date and time
    formatDateTime(dateString) {
        if (!dateString) return '-';
        const date = new Date(dateString);
        return date.toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    },

    // Format relative time
    formatRelativeTime(dateString) {
        if (!dateString) return '-';
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return this.formatDate(dateString);
    },

    // Get status badge HTML
    getStatusBadge(status) {
        const statusClass = status ? status.toLowerCase() : 'unknown';
        return `<span class="badge badge-${statusClass}">${status || 'Unknown'}</span>`;
    },

    // Capitalize first letter
    capitalize(str) {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    },

    // Truncate text
    truncate(text, length = 50) {
        if (!text) return '';
        if (text.length <= length) return text;
        return text.substring(0, length) + '...';
    },

    // Escape HTML
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    // Generate random ID
    generateId() {
        return Math.random().toString(36).substring(2, 9);
    },

    // Debounce function
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
};

// Toast Notification System
const Toast = {
    container: null,

    init() {
        this.container = document.getElementById('toastContainer');
    },

    show(type, title, message, duration = 5000) {
        if (!this.container) this.init();

        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <span class="toast-icon">${icons[type] || icons.info}</span>
            <div class="toast-content">
                <div class="toast-title">${Utils.escapeHtml(title)}</div>
                <div class="toast-message">${Utils.escapeHtml(message)}</div>
            </div>
            <button class="toast-close" onclick="this.parentElement.remove()">×</button>
        `;

        this.container.appendChild(toast);

        // Auto remove
        setTimeout(() => {
            if (toast.parentElement) {
                toast.remove();
            }
        }, duration);
    },

    success(title, message) {
        this.show('success', title, message);
    },

    error(title, message) {
        this.show('error', title, message);
    },

    warning(title, message) {
        this.show('warning', title, message);
    },

    info(title, message) {
        this.show('info', title, message);
    }
};

// Modal System
const Modal = {
    overlay: null,
    content: null,

    init() {
        this.overlay = document.getElementById('modalOverlay');
        this.content = document.getElementById('modalContent');

        // Close on overlay click
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) {
                this.close();
            }
        });

        // Close on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.overlay.classList.contains('active')) {
                this.close();
            }
        });
    },

    open(html) {
        if (!this.overlay) this.init();
        this.content.innerHTML = html;
        this.overlay.classList.add('active');
    },

    close() {
        if (!this.overlay) return;
        this.overlay.classList.remove('active');
        this.content.innerHTML = '';
    },

    // Confirmation modal
    confirm(title, message, onConfirm, confirmText = 'Confirm', confirmClass = 'btn-primary') {
        const html = `
            <div class="modal-header">
                <h3>${Utils.escapeHtml(title)}</h3>
                <button class="modal-close" onclick="Modal.close()">×</button>
            </div>
            <div class="modal-body">
                <p>${Utils.escapeHtml(message)}</p>
            </div>
            <div class="modal-footer">
                <button class="btn btn-outline" onclick="Modal.close()">Cancel</button>
                <button class="btn ${confirmClass}" id="modalConfirmBtn">${Utils.escapeHtml(confirmText)}</button>
            </div>
        `;

        this.open(html);

        document.getElementById('modalConfirmBtn').addEventListener('click', () => {
            onConfirm();
            this.close();
        });
    }
};

// Loading state helper
const Loading = {
    show(element, colspan = 1) {
        if (element) {
            element.innerHTML = `<tr><td colspan="${colspan}" class="loading">Loading...</td></tr>`;
        }
    },

    hide(element, colspan = 1, message = 'No records found') {
        if (element && element.children.length === 0) {
            element.innerHTML = `<tr><td colspan="${colspan}" class="empty-state">${message}</td></tr>`;
        }
    }
};
