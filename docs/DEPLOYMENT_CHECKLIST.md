# Deployment Checklist

## ✅ Pre-Deployment Setup

### System Requirements
- [ ] Node.js v14+ installed
- [ ] MySQL 8.0+ installed and running
- [ ] npm installed (comes with Node.js)
- [ ] Git (optional, for version control)

### Database Setup
- [ ] MySQL service is running
- [ ] Root password is known
- [ ] Sufficient disk space for database

### Network/Firewall
- [ ] Port 3000 is available
- [ ] MySQL port 3306 is accessible
- [ ] No firewall blocking localhost connections

## 📋 Step-by-Step Deployment

### Step 1: Project Files
```powershell
# Navigate to project directory
cd h:\dbmsproject

# Verify all directories exist
dir
# Should see: client, server, sql, README.md
```

### Step 2: Database Deployment
```powershell
# Method 1: MySQL Command Line
mysql -u root -p

# Inside MySQL:
CREATE DATABASE banking_system;
exit;

# Import schema
mysql -u root -p banking_system < sql/schema.sql

# Verify import
mysql -u root -p banking_system -e "SHOW TABLES;"
# Should see: accounts, audit_logs, customers, transaction_reversals, transactions, users
```

### Step 3: Backend Configuration
```powershell
cd server

# Install dependencies
npm install

# Should install:
# - express
# - mysql2
# - jsonwebtoken
# - bcryptjs
# - dotenv
# - cors
```

**Configure .env file**:
```env
PORT=3000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=YOUR_MYSQL_PASSWORD_HERE  # ⚠️ UPDATE THIS
DB_NAME=banking_system
JWT_SECRET=banking_secret_key_2024
JWT_EXPIRE=24h
NODE_ENV=development
```

### Step 4: Start Backend Server
```powershell
# From server directory
npm start

# Expected output:
# ╔════════════════════════════════════════════════╗
# ║  Banking Management System - Backend Server    ║
# ║  Server running on: http://localhost:3000      ║
# ╚════════════════════════════════════════════════╝
# ✓ Database connected successfully
```

### Step 5: Access Application
- [ ] Open browser
- [ ] Navigate to http://localhost:3000
- [ ] Login page should appear
- [ ] Try logging in with: admin / password123

## 🔍 Verification Steps

### Database Verification
```sql
-- Check tables exist
SHOW TABLES;

-- Check stored procedures
SHOW PROCEDURE STATUS WHERE Db = 'banking_system';

-- Check sample data
SELECT COUNT(*) FROM users;        -- Should be 4
SELECT COUNT(*) FROM customers;    -- Should be 3
SELECT COUNT(*) FROM accounts;     -- Should be 6
SELECT COUNT(*) FROM transactions; -- Should be 10+

-- Check views
SELECT * FROM vw_account_summary LIMIT 5;

-- Check triggers
SHOW TRIGGERS;
```

### Backend Verification
```powershell
# Check if server is running
netstat -ano | findstr :3000

# Test API endpoint (in browser or curl)
# Open: http://localhost:3000/api/health
# Should return: {"status":"healthy","timestamp":"...","uptime":...}
```

### Frontend Verification
```
Open browser DevTools (F12)
Navigate to http://localhost:3000
Console tab should show:
- No errors
- "🔐 Auth initialized" (or similar)
- "🏦 Banking System loaded" (or similar)
```

## ⚠️ Troubleshooting

### Problem: MySQL connection fails
```
Error: Access denied for user 'root'@'localhost'
```
**Solution**:
1. Verify MySQL password
2. Update `server/.env` with correct password
3. Test connection: `mysql -u root -p`

### Problem: Port 3000 already in use
```
Error: EADDRINUSE :::3000
```
**Solution**:
```powershell
# Find process
netstat -ano | findstr :3000

# Kill process (replace 12345 with actual PID)
taskkill /F /PID 12345

# Or change port in server/.env
PORT=3001
```

### Problem: Schema import errors
```
Error: Unknown database 'banking_system'
```
**Solution**:
1. Create database first: `CREATE DATABASE banking_system;`
2. Then import schema

### Problem: Dependencies not installing
```
npm ERR! ...
```
**Solution**:
```powershell
# Clear npm cache
npm cache clean --force

# Delete node_modules and package-lock.json
Remove-Item -Recurse -Force node_modules
Remove-Item package-lock.json

# Reinstall
npm install
```

### Problem: Frontend 404 errors
```
GET http://localhost:3000/api/auth/login 404
```
**Solution**:
1. Ensure backend server is running
2. Check server terminal for errors
3. Access via http://localhost:3000 (not file://)
4. Verify routes are loaded (check server.js)

### Problem: Empty dashboard
```
Dashboard shows 0 for all statistics
```
**Solution**:
1. Verify sample data loaded: `SELECT COUNT(*) FROM accounts;`
2. Check API response in browser DevTools Network tab
3. Look for SQL errors in server terminal
4. Verify stored procedures exist: `SHOW PROCEDURE STATUS WHERE Db = 'banking_system';`

## 🔐 Security Checklist

### Production Deployment (If needed)
- [ ] Change JWT_SECRET to a strong random string
- [ ] Change all default passwords
- [ ] Set NODE_ENV=production
- [ ] Enable HTTPS
- [ ] Configure CORS properly
- [ ] Set up database backups
- [ ] Configure firewall rules
- [ ] Use environment variables for sensitive data
- [ ] Implement rate limiting
- [ ] Add input sanitization
- [ ] Enable SQL query logging for audit

### Password Security
```sql
-- Change default user passwords
UPDATE users 
SET password_hash = SHA2('NEW_SECURE_PASSWORD', 256) 
WHERE username = 'admin';

-- Repeat for other users
```

## 📦 Backup & Restore

### Backup Database
```powershell
# Full backup
mysqldump -u root -p banking_system > backup_YYYYMMDD.sql

# Schema only
mysqldump -u root -p --no-data banking_system > schema_backup.sql

# Data only
mysqldump -u root -p --no-create-info banking_system > data_backup.sql
```

### Restore Database
```powershell
# Full restore
mysql -u root -p banking_system < backup_YYYYMMDD.sql

# Schema only
mysql -u root -p banking_system < schema_backup.sql

# Data only
mysql -u root -p banking_system < data_backup.sql
```

## 🔄 Restart Procedure

### Clean Restart
```powershell
# 1. Stop server (Ctrl+C in server terminal)

# 2. Verify port is free
netstat -ano | findstr :3000
# Should return nothing

# 3. Restart MySQL (if needed)
net stop MySQL80
net start MySQL80

# 4. Start server
cd h:\dbmsproject\server
npm start
```

### Fresh Installation
```powershell
# 1. Stop server

# 2. Drop and recreate database
mysql -u root -p -e "DROP DATABASE IF EXISTS banking_system;"
mysql -u root -p -e "CREATE DATABASE banking_system;"
mysql -u root -p banking_system < sql/schema.sql

# 3. Clear node_modules
cd server
Remove-Item -Recurse -Force node_modules
npm install

# 4. Start server
npm start
```

## 📊 Post-Deployment Testing

### Quick Smoke Test (2 minutes)
1. [ ] Login with admin/password123
2. [ ] Dashboard loads and shows statistics
3. [ ] Click each navigation item
4. [ ] Verify no console errors (F12)
5. [ ] Logout

### Basic Functionality Test (5 minutes)
1. [ ] Login
2. [ ] View accounts
3. [ ] Create new deposit
4. [ ] View transactions
5. [ ] Check audit logs
6. [ ] Logout

### Comprehensive Test (15 minutes)
Follow the TESTING_GUIDE.md checklist

## 📝 Deployment Log Template

```
# Deployment Log

Date: _______________
Environment: Development/Production
Deployed By: _______________

## Steps Completed
- [ ] Database created
- [ ] Schema imported
- [ ] Sample data loaded
- [ ] Dependencies installed
- [ ] Configuration updated
- [ ] Server started
- [ ] Frontend accessible
- [ ] Login tested
- [ ] Basic functionality verified

## Configuration
- Database: banking_system
- Backend Port: 3000
- Node.js Version: _______________
- MySQL Version: _______________

## Issues Encountered
1. 
2. 
3. 

## Resolution
1. 
2. 
3. 

## Test Results
- Login: ✅/❌
- Dashboard: ✅/❌
- Transactions: ✅/❌
- Reports: ✅/❌

## Notes
_______________________________________________
_______________________________________________
_______________________________________________

## Sign-off
Deployed and verified by: _______________
Date: _______________
```

## 🎯 Success Criteria

### Minimum Viable Deployment
- [ ] Database created with all tables
- [ ] Server starts without errors
- [ ] Can login with admin credentials
- [ ] Dashboard shows some statistics
- [ ] Can navigate all pages

### Full Production-Ready Deployment
- [ ] All above criteria met
- [ ] All sample data loaded correctly
- [ ] All transactions work (deposit, withdrawal, transfer)
- [ ] Reversals work with audit trail
- [ ] Reports generate correctly
- [ ] Simulation scenarios work
- [ ] No errors in logs
- [ ] Performance is acceptable
- [ ] Security measures in place
- [ ] Backups configured
- [ ] Documentation complete

## 📞 Support

### Before Asking for Help
1. Check README.md
2. Review TESTING_GUIDE.md
3. Read error messages carefully
4. Check browser console (F12)
5. Review server terminal logs
6. Verify database connection
7. Confirm all files exist

### Information to Provide
- Operating System
- Node.js version (`node --version`)
- MySQL version (`mysql --version`)
- Error messages (exact text)
- Steps to reproduce
- What you've tried

---

## ✅ Final Checklist

Before considering deployment complete:
- [ ] All files in correct locations
- [ ] Database has all tables, procedures, triggers, views
- [ ] Sample data loaded
- [ ] Server starts and connects to database
- [ ] Login works with default credentials
- [ ] Dashboard shows accurate statistics
- [ ] All navigation items work
- [ ] Can perform basic transactions
- [ ] Audit logs are recording
- [ ] No console errors
- [ ] No server errors
- [ ] README.md is read and understood
- [ ] TESTING_GUIDE.md is available
- [ ] This checklist is complete

**🎉 If all boxes are checked, deployment is SUCCESSFUL! 🎉**

---

**Deployment Version**: 1.0.0
**Last Updated**: 2024
