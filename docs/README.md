# Banking Management System

A comprehensive, production-ready Banking Management System built with a three-tier architecture featuring a dynamic web interface, RESTful API backend, and MySQL database with advanced stored procedures, triggers, and views.

## 🏗️ Architecture

### Three-Tier Architecture
- **Presentation Layer**: Dynamic HTML/CSS/JavaScript (Vanilla JS, no frameworks)
- **Application Layer**: Node.js + Express.js RESTful API
- **Data Layer**: MySQL with InnoDB, stored procedures, triggers, views

## 🚀 Features

### Core Banking Operations
- ✅ **Account Management**: Create, view, update, and close accounts (Savings, Checking, Business)
- 💸 **Transaction Processing**: Deposits, withdrawals, transfers with ACID compliance
- 🔄 **Transaction Reversals**: Complete audit trail with reversal support
- 📊 **Real-time Dashboard**: Live statistics and recent activity
- 📈 **Reports & Analytics**: Comprehensive reporting with date ranges and filters
- 🔍 **Audit Logs**: Complete system audit trail with user tracking
- 🎮 **Transaction Simulation**: Test various scenarios (success, failures, stuck transactions)

### Security & Access Control
- 🔐 Role-based access control (Admin, Manager, Teller, Auditor)
- 🔑 JWT authentication with secure token management
- 🛡️ Input validation and SQL injection prevention
- 📝 Comprehensive audit logging

### Database Features
- 🗄️ Stored procedures for all business logic
- ⚡ Database triggers for automated actions
- 👁️ Views for optimized data retrieval
- 🔄 ACID-compliant transactions
- 🎯 Referential integrity with foreign keys
- 📈 Sample data for testing

## 📋 Prerequisites

- **Node.js** v14 or higher
- **MySQL** 8.0 or higher
- **npm** (comes with Node.js)

## ⚙️ Installation & Setup

### 1. Clone/Download the Project

```powershell
cd h:\dbmsproject
```

### 2. Database Setup

#### Start MySQL Server
Ensure MySQL is running on your system.

#### Create Database and Import Schema

```powershell
# Login to MySQL
mysql -u root -p

# In MySQL prompt, create the database
CREATE DATABASE banking_system;
exit;

# Import the schema
mysql -u root -p banking_system < sql/schema.sql
```

**Note**: The schema includes:
- All table structures
- Sample data (users, accounts, transactions)
- Stored procedures for business logic
- Triggers for automated actions
- Views for optimized queries

### 3. Backend Setup

#### Install Dependencies

```powershell
cd server
npm install
```

#### Configure Environment Variables

The `.env` file is already configured with default settings:

```env
PORT=3000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=DBMSPASS
DB_NAME=banking_system
JWT_SECRET=banking_secret_key_2024
JWT_EXPIRE=24h
NODE_ENV=development
```

**Update `DB_PASSWORD`** to match your MySQL root password if different.

#### Start the Server

```powershell
npm start
```

You should see:
```
╔══════════════════════════════════════════════════════════╗
║     Banking Management System - Backend Server           ║
║     Server running on: http://localhost:3000             ║
╚══════════════════════════════════════════════════════════╝
✓ Database connected successfully
```

### 4. Access the Application

Open your browser and navigate to:
```
http://localhost:3000
```

## 👤 Default User Accounts

The system comes with pre-configured user accounts for testing:

| Username   | Password     | Role      | Description                           |
|-----------|--------------|-----------|---------------------------------------|
| admin     | password123  | Admin     | Full system access                    |
| manager1  | password123  | Manager   | Account management and reports        |
| teller1   | password123  | Teller    | Customer transactions                 |
| auditor1  | password123  | Auditor   | View-only access for audit logs       |

## 📱 Application Pages

### 1. Dashboard
- Real-time statistics (total customers, accounts, transactions, balance)
- Recent transactions table
- Quick action buttons
- System health indicators

### 2. Accounts Management
- View all customer accounts
- Create new accounts (Savings, Checking, Business)
- Update account details
- Close accounts
- Filter by account type and status

### 3. Transactions
- View all transactions with filters
- Perform deposits, withdrawals, and transfers
- Transaction history with pagination
- Real-time balance updates

### 4. Transaction Reversals
- View all reversals
- Reverse transactions with audit trail
- Reason tracking and documentation
- Approval workflow

### 5. Audit Logs
- Comprehensive system activity log
- Filter by user, action type, and date
- IP address tracking
- Real-time updates

### 6. Reports & Analytics
- Daily transaction summary
- Account balance summary
- User activity reports
- Date range filtering
- Export capabilities

### 7. Transaction Simulation
- Test successful transactions
- Simulate transaction failures
- Test stuck/timeout scenarios
- Automatic retry mechanisms
- Performance testing

## 🗂️ Project Structure

```
h:\dbmsproject\
├── sql/
│   └── schema.sql                 # Database schema, procedures, triggers, views
├── server/
│   ├── config/
│   │   └── database.js           # MySQL connection configuration
│   ├── middleware/
│   │   └── auth.js               # JWT authentication middleware
│   ├── routes/
│   │   ├── auth.js               # Authentication endpoints
│   │   ├── dashboard.js          # Dashboard data endpoints
│   │   ├── accounts.js           # Account management endpoints
│   │   ├── transactions.js       # Transaction endpoints
│   │   ├── reversals.js          # Reversal endpoints
│   │   ├── logs.js               # Audit log endpoints
│   │   ├── reports.js            # Report generation endpoints
│   │   └── simulation.js         # Transaction simulation endpoints
│   ├── .env                      # Environment variables
│   ├── package.json              # Node.js dependencies
│   └── server.js                 # Express application entry point
└── client/
    ├── index.html                # Single-page application
    ├── css/
    │   └── styles.css            # Application styles
    └── js/
        ├── api.js                # API communication layer
        ├── utils.js              # Utility functions
        ├── app.js                # Application initialization
        ├── auth.js               # Authentication handling
        ├── dashboard.js          # Dashboard module
        ├── accounts.js           # Accounts module
        ├── transactions.js       # Transactions module
        ├── reversals.js          # Reversals module
        ├── logs.js               # Audit logs module
        ├── reports.js            # Reports module
        └── simulation.js         # Simulation module
```

## 🔧 API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/verify` - Verify JWT token

### Dashboard
- `GET /api/dashboard/summary` - Get dashboard statistics
- `GET /api/dashboard/recent-transactions` - Get recent transactions

### Accounts
- `GET /api/accounts` - List all accounts
- `GET /api/accounts/:id` - Get account details
- `POST /api/accounts` - Create new account
- `PUT /api/accounts/:id` - Update account
- `DELETE /api/accounts/:id` - Close account

### Transactions
- `GET /api/transactions` - List all transactions
- `GET /api/transactions/:id` - Get transaction details
- `POST /api/transactions/deposit` - Deposit money
- `POST /api/transactions/withdrawal` - Withdraw money
- `POST /api/transactions/transfer` - Transfer between accounts

### Reversals
- `GET /api/reversals` - List all reversals
- `POST /api/reversals/:transactionId` - Reverse a transaction

### Audit Logs
- `GET /api/logs` - Get audit logs
- `GET /api/logs/stats` - Get log statistics

### Reports
- `GET /api/reports/daily-summary` - Daily transaction summary
- `GET /api/reports/account-balances` - Account balance report
- `GET /api/reports/user-activity` - User activity report

### Simulation
- `POST /api/simulation/success` - Simulate successful transaction
- `POST /api/simulation/failure` - Simulate failed transaction
- `POST /api/simulation/stuck` - Simulate stuck transaction
- `GET /api/simulation/stuck-transactions` - Get stuck transactions

## 🗄️ Database Schema

### Main Tables
- **users**: System users with roles and authentication
- **customers**: Customer information
- **accounts**: Bank accounts (Savings, Checking, Business)
- **transactions**: All financial transactions
- **transaction_reversals**: Reversal records
- **audit_logs**: System activity audit trail

### Stored Procedures
- `sp_create_account`: Create new account
- `sp_deposit`: Process deposit
- `sp_withdraw`: Process withdrawal
- `sp_transfer`: Process transfer
- `sp_reverse_transaction`: Reverse a transaction
- `sp_get_account_balance`: Get current balance
- `sp_get_transaction_history`: Get transaction history
- `sp_daily_summary`: Generate daily summary report
- `sp_simulate_stuck_transaction`: Create stuck transaction for testing

### Triggers
- `trg_audit_user_login`: Log user logins
- `trg_audit_account_create`: Log account creation
- `trg_audit_transaction`: Log all transactions
- `trg_validate_transaction`: Validate transaction data
- `trg_update_account_balance`: Update account balance after transaction

### Views
- `vw_account_summary`: Account overview with balances
- `vw_transaction_detail`: Detailed transaction information
- `vw_daily_summary`: Daily transaction aggregates
- `vw_user_activity`: User activity summary

## 🧪 Testing

### Manual Testing Workflow

1. **Login** as different users to test role-based access
2. **Dashboard**: Verify statistics and recent transactions
3. **Create Account**: Test all account types
4. **Deposit**: Make deposits to accounts
5. **Withdrawal**: Test withdrawal with sufficient/insufficient balance
6. **Transfer**: Test transfers between accounts
7. **Reversal**: Reverse a transaction and verify audit trail
8. **Reports**: Generate various reports with different filters
9. **Simulation**: Run all simulation scenarios

### Sample Test Scenarios

#### Successful Transaction Flow
```
1. Login as teller1
2. Navigate to Accounts
3. Create a new Savings account for customer Alice Johnson
4. Navigate to Transactions
5. Deposit $1000 to the new account
6. Verify balance is $1000
7. Withdraw $300
8. Verify balance is $700
```

#### Transfer Flow
```
1. Create two accounts
2. Deposit $5000 to Account 1
3. Transfer $2000 from Account 1 to Account 2
4. Verify Account 1 balance is $3000
5. Verify Account 2 balance is $2000
6. Check audit logs for transfer record
```

#### Reversal Flow
```
1. Find a completed transaction
2. Click "Reverse Transaction"
3. Enter reversal reason
4. Verify reversal is logged
5. Check that balances are reverted
6. Verify audit trail in logs
```

## 🔒 Security Features

- **JWT Authentication**: Secure token-based authentication
- **Password Hashing**: Passwords stored as SHA-256 hashes
- **Role-Based Access**: Different permissions for different roles
- **SQL Injection Prevention**: All queries use stored procedures
- **Audit Trail**: Complete logging of all system actions
- **Session Management**: Automatic token expiration
- **Input Validation**: Client and server-side validation

## 📊 Performance Considerations

- **Database Indexing**: Optimized indexes on frequently queried columns
- **Connection Pooling**: MySQL connection pool for better performance
- **Stored Procedures**: Reduced network overhead
- **Views**: Pre-computed aggregations for reports
- **Pagination**: Large result sets are paginated

## 🐛 Troubleshooting

### Database Connection Issues
```
Error: Access denied for user 'root'@'localhost'
```
**Solution**: Update `DB_PASSWORD` in `server/.env` to match your MySQL password

### Port Already in Use
```
Error: EADDRINUSE :::3000
```
**Solution**: 
```powershell
# Find process using port 3000
netstat -ano | findstr :3000

# Kill the process (replace PID with actual process ID)
taskkill /F /PID [PID]
```

### Schema Import Errors
```
Error: Unknown database 'banking_system'
```
**Solution**: Create database first: `CREATE DATABASE banking_system;`

### Frontend 404 Errors
**Solution**: Ensure you're accessing `http://localhost:3000` (backend server), not a separate static server

## 🔄 Maintenance

### Database Backup
```powershell
mysqldump -u root -p banking_system > backup.sql
```

### Database Restore
```powershell
mysql -u root -p banking_system < backup.sql
```

### Clear All Data (Keep Schema)
```sql
TRUNCATE TABLE audit_logs;
TRUNCATE TABLE transaction_reversals;
TRUNCATE TABLE transactions;
TRUNCATE TABLE accounts;
TRUNCATE TABLE customers;
```

## 📚 Technologies Used

### Backend
- **Node.js**: JavaScript runtime
- **Express.js**: Web application framework
- **MySQL2**: MySQL client for Node.js
- **jsonwebtoken**: JWT authentication
- **bcryptjs**: Password hashing
- **dotenv**: Environment variable management
- **cors**: Cross-origin resource sharing

### Frontend
- **HTML5**: Semantic markup
- **CSS3**: Modern styling with flexbox and grid
- **Vanilla JavaScript**: No frameworks, pure ES6+

### Database
- **MySQL 8.0**: Relational database
- **InnoDB**: ACID-compliant storage engine
- **Stored Procedures**: Business logic encapsulation
- **Triggers**: Automated actions
- **Views**: Query optimization

## 👨‍💻 Development

### Adding New Features

1. **Database**: Add tables/procedures in `sql/schema.sql`
2. **Backend**: Create route in `server/routes/`
3. **Frontend**: Add module in `client/js/` and UI in `index.html`
4. **Test**: Verify end-to-end functionality

### Code Style
- Use ES6+ features
- Follow async/await pattern
- Use try-catch for error handling
- Comment complex business logic
- Use descriptive variable names

## 📄 License

This project is created for educational purposes as a DBMS project demonstration.

## 🤝 Support

For issues, questions, or contributions:
1. Check the troubleshooting section
2. Review the code comments
3. Test with default credentials
4. Verify database connection

## 🎯 Project Objectives Achieved

✅ Three-tier architecture implementation  
✅ Dynamic, data-driven web interface  
✅ RESTful API with authentication  
✅ Comprehensive MySQL database with stored procedures  
✅ ACID-compliant transactions  
✅ Role-based access control  
✅ Complete audit trail  
✅ Real-time dashboard  
✅ Transaction simulation and testing  
✅ Professional UI/UX  
✅ Production-ready code quality  

---

**Built with ❤️ for Database Management Systems Project**

**Version**: 1.0.0  
**Last Updated**: 2024
