// Authentication Module

const Auth = {
    currentUser: null,

    // Initialize auth state
    init() {
        const token = localStorage.getItem('token');
        const user = localStorage.getItem('user');

        if (token && user) {
            try {
                this.currentUser = JSON.parse(user);
                this.showApp();
                return true;
            } catch (e) {
                this.logout();
            }
        }

        this.showLogin();
        return false;
    },

    // Login
    async login(username, password) {
        const result = await Api.post('/auth/login', { username, password });

        if (result.success) {
            localStorage.setItem('token', result.data.token);
            localStorage.setItem('user', JSON.stringify(result.data.user));
            this.currentUser = result.data.user;
            this.showApp();
            App.init();
            return { success: true };
        }

        return { success: false, message: result.message || 'Login failed' };
    },

    // Logout
    async logout() {
        try {
            await Api.post('/auth/logout', {});
        } catch (e) {
            // Ignore logout errors
        }

        localStorage.removeItem('token');
        localStorage.removeItem('user');
        this.currentUser = null;
        this.showLogin();
    },

    // Show login page
    showLogin() {
        document.getElementById('loginPage').style.display = 'flex';
        document.getElementById('mainApp').style.display = 'none';
    },

    // Show main app
    showApp() {
        document.getElementById('loginPage').style.display = 'none';
        document.getElementById('mainApp').style.display = 'flex';

        // Update user info in header
        if (this.currentUser) {
            document.getElementById('userName').textContent = this.currentUser.fullName;
            document.getElementById('userRole').textContent = Utils.capitalize(this.currentUser.role);
        }

        // Hide elements based on role
        this.applyRoleRestrictions();
    },

    // Apply role-based restrictions
    applyRoleRestrictions() {
        const role = this.currentUser?.role;
        
        // Hide nav items based on role
        document.querySelectorAll('[data-roles]').forEach(el => {
            const allowedRoles = el.dataset.roles.split(',').map(r => r.trim());
            if (!allowedRoles.includes(role)) {
                el.style.display = 'none';
            } else {
                el.style.display = '';
            }
        });

        // Apply role-specific UI adjustments
        switch(role) {
            case 'auditor':
                // Auditors are read-only - hide all action buttons
                document.querySelectorAll('.action-buttons').forEach(el => {
                    el.style.display = 'none';
                });
                // Add read-only badge
                this.addReadOnlyIndicator();
                break;
                
            case 'teller':
                // Tellers can see transaction buttons but not approvals/reversals
                // Already handled by data-roles in navigation
                break;
                
            case 'manager':
            case 'admin':
                // Full access - nothing to hide
                break;
        }
    },
    
    // Add read-only indicator for auditors
    addReadOnlyIndicator() {
        const roleElement = document.getElementById('userRole');
        if (roleElement && !roleElement.querySelector('.read-only-badge')) {
            const badge = document.createElement('span');
            badge.className = 'read-only-badge';
            badge.textContent = ' (Read-Only)';
            badge.style.fontSize = '0.85em';
            badge.style.opacity = '0.8';
            roleElement.appendChild(badge);
        }
    },

    // Check if user has role
    hasRole(...roles) {
        return roles.includes(this.currentUser?.role);
    },

    // Get current user
    getUser() {
        return this.currentUser;
    }
};

// Login form handler
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorEl = document.getElementById('loginError');
    const submitBtn = e.target.querySelector('button[type="submit"]');

    submitBtn.disabled = true;
    submitBtn.textContent = 'Signing in...';
    errorEl.textContent = '';

    const result = await Auth.login(username, password);

    if (!result.success) {
        errorEl.textContent = result.message;
    }

    submitBtn.disabled = false;
    submitBtn.textContent = 'Sign In';
});

// Logout button handler
document.getElementById('logoutBtn').addEventListener('click', () => {
    Modal.confirm(
        'Logout',
        'Are you sure you want to logout?',
        () => Auth.logout(),
        'Logout',
        'btn-danger'
    );
});
