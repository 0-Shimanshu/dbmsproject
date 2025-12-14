const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'banking_system_super_secret_key_2024';

// Verify JWT token
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Access token required'
        });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({
                success: false,
                message: 'Invalid or expired token'
            });
        }
        req.user = user;
        next();
    });
};

// Check if user has required role
const authorizeRoles = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Insufficient permissions'
            });
        }

        next();
    };
};

// Admin only middleware
const adminOnly = authorizeRoles('admin');

// Manager and admin middleware
const managerOrAdmin = authorizeRoles('admin', 'manager');

// Teller and above middleware
const tellerAndAbove = authorizeRoles('admin', 'manager', 'teller');

// All authenticated users including auditor
const allAuthenticated = authorizeRoles('admin', 'manager', 'teller', 'auditor');

module.exports = {
    authenticateToken,
    authorizeRoles,
    adminOnly,
    managerOrAdmin,
    tellerAndAbove,
    allAuthenticated
};
