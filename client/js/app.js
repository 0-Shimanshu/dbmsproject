// Main Application

const App = {
    currentPage: 'dashboard',

    // Initialize application
    init() {
        // Initialize modal and toast
        Modal.init();
        Toast.init();

        // Setup navigation
        this.setupNavigation();

        // Load dashboard
        this.navigateTo('dashboard');
    },

    // Setup navigation
    setupNavigation() {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const page = item.dataset.page;
                if (page) {
                    this.navigateTo(page);
                }
            });
        });
    },

    // Navigate to page
    async navigateTo(page) {
        // Update active nav item
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.page === page) {
                item.classList.add('active');
            }
        });

        // Update page title
        const titles = {
            dashboard: 'Dashboard',
            accounts: 'Accounts',
            transactions: 'Transactions',
            approvals: 'Transfer Approvals',
            reversals: 'Reversals',
            logs: 'Audit Logs',
            reports: 'Reports & Analytics',
            simulation: 'Transaction Simulation'
        };
        document.getElementById('pageTitle').textContent = titles[page] || 'Dashboard';

        // Hide all pages
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

        // Show selected page
        const pageEl = document.getElementById(`${page}Page`);
        if (pageEl) {
            pageEl.classList.add('active');
        }

        this.currentPage = page;

        // Re-apply role restrictions when navigating
        if (Auth.currentUser) {
            Auth.applyRoleRestrictions();
        }

        // Load page data
        switch (page) {
            case 'dashboard':
                await Dashboard.init();
                break;
            case 'accounts':
                await Accounts.init();
                break;
            case 'transactions':
                await Transactions.init();
                break;
            case 'approvals':
                await Approvals.init(Auth.currentUser);
                break;
            case 'reversals':
                await Reversals.init();
                break;
            case 'logs':
                await Logs.init();
                break;
            case 'reports':
                await Reports.init();
                break;
            case 'simulation':
                await Simulation.init();
                break;
        }
    }
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    if (Auth.init()) {
        App.init();
    }
});
