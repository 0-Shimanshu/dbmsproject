# Banking System User Roles - Permissions Matrix

## Why 4 Different User Roles?

In a real banking system, different employees have different responsibilities and access levels. This follows the **principle of least privilege** - users should only have access to what they need for their job.

## Role Breakdown

### 1. **Teller** 👤
**Purpose**: Front-line bank employees who handle customer transactions

**Can Do**:
- ✅ View accounts
- ✅ Create deposits and withdrawals
- ✅ Create transfers (up to daily limit)
- ✅ View transaction history
- ✅ Process routine banking operations

**Cannot Do**:
- ❌ Approve large transfers (> $50,000 daily limit)
- ❌ Request transaction reversals
- ❌ Freeze/unfreeze accounts
- ❌ View full audit logs
- ❌ Generate reports
- ❌ Override system limits

**Real-World Example**: Bank teller at the counter processing customer deposits and withdrawals.

---

### 2. **Manager** 👨‍💼
**Purpose**: Supervisors who oversee operations and handle exceptions

**Can Do**:
- ✅ Everything a Teller can do, PLUS:
- ✅ **Approve large transfers** exceeding daily limits
- ✅ **Request transaction reversals**
- ✅ **Approve reversal requests**
- ✅ Override daily transfer limits
- ✅ Freeze/unfreeze accounts
- ✅ View detailed reports
- ✅ Handle stuck transactions

**Cannot Do**:
- ❌ Create new users
- ❌ Modify system configuration
- ❌ Delete audit logs
- ❌ Full system administration

**Real-World Example**: Branch manager who approves large transactions and handles escalations.

---

### 3. **Admin** 👑
**Purpose**: System administrators with full control

**Can Do**:
- ✅ Everything Manager can do, PLUS:
- ✅ **Create/manage users**
- ✅ **Modify system configuration**
- ✅ Process any transaction regardless of limits
- ✅ Full database access
- ✅ System maintenance
- ✅ Emergency overrides

**Cannot Do**:
- (Nothing - has full access)

**Real-World Example**: IT administrator or head of operations with full system access.

---

### 4. **Auditor** 🔍
**Purpose**: Compliance/audit staff who review transactions but don't process them

**Can Do**:
- ✅ **View all transactions** (read-only)
- ✅ **View all audit logs** (read-only)
- ✅ **Generate reports**
- ✅ View account details
- ✅ Review transaction history
- ✅ Access compliance data

**Cannot Do**:
- ❌ Create transactions
- ❌ Modify accounts
- ❌ Approve transfers
- ❌ Freeze accounts
- ❌ Any write operations

**Real-World Example**: Internal auditor or compliance officer reviewing transactions for fraud/irregularities.

---

## Permissions Matrix

| Feature | Teller | Manager | Admin | Auditor |
|---------|--------|---------|-------|---------|
| View Accounts | ✅ | ✅ | ✅ | ✅ |
| Create Deposits/Withdrawals | ✅ | ✅ | ✅ | ❌ |
| Create Transfers (within limit) | ✅ | ✅ | ✅ | ❌ |
| Create Large Transfers (>$50k) | ⏳ Pending | ✅ Immediate | ✅ Immediate | ❌ |
| **Approve Large Transfers** | ❌ | ✅ | ✅ | ❌ |
| Request Reversals | ❌ | ✅ | ✅ | ❌ |
| Approve Reversals | ❌ | ✅ | ✅ | ❌ |
| Freeze/Unfreeze Accounts | ❌ | ✅ | ✅ | ❌ |
| View Audit Logs | Limited | ✅ | ✅ | ✅ Full |
| Generate Reports | ❌ | ✅ | ✅ | ✅ |
| Simulation/Testing | ✅ | ✅ | ✅ | ❌ |
| Create Users | ❌ | ❌ | ✅ | ❌ |
| System Configuration | ❌ | ❌ | ✅ | ❌ |

---

## Real-World Scenarios

### Scenario 1: Customer Wants to Deposit $500
- **Who**: Teller
- **Action**: Creates deposit transaction
- **Result**: ✅ Completes immediately
- **No approval needed**

### Scenario 2: Customer Wants to Transfer $75,000
- **Who**: Teller
- **Action**: Creates transfer transaction
- **Result**: ⏳ Goes to pending approval queue
- **Manager must approve** before funds move

### Scenario 3: Manager Needs to Transfer $75,000
- **Who**: Manager
- **Action**: Creates transfer transaction
- **Result**: ✅ Completes immediately (override)
- **No approval needed** (trusted user)

### Scenario 4: Wrong Transaction Needs Reversal
- **Who**: Manager
- **Action**: Requests reversal with reason
- **Result**: ⏳ Another manager/admin must approve
- **Prevents single-person fraud**

### Scenario 5: Monthly Compliance Review
- **Who**: Auditor
- **Action**: Reviews all transactions, generates reports
- **Result**: ✅ Can see everything but can't modify
- **Separation of duties**

---

## Security Benefits

### 1. **Separation of Duties**
- No single person can both initiate AND approve large transactions
- Prevents insider fraud

### 2. **Accountability**
- Every action is logged with user identity
- Audit trail shows who did what

### 3. **Principle of Least Privilege**
- Users only have permissions they need
- Limits damage from compromised accounts

### 4. **Fraud Prevention**
- Tellers can't steal large amounts (requires approval)
- Auditors can detect irregularities without interfering

### 5. **Compliance**
- Meets banking regulations requiring dual authorization
- Satisfies audit requirements

---

## Code Implementation

### In Database (sql/schema.sql):
```sql
CREATE TABLE users (
    user_id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) NOT NULL UNIQUE,
    role ENUM('admin', 'teller', 'manager', 'auditor') NOT NULL DEFAULT 'teller',
    -- ... other fields
);
```

### In Backend (middleware/auth.js):
```javascript
// Check if user has required role
const authorizeRoles = (...allowedRoles) => {
    return (req, res, next) => {
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Insufficient permissions'
            });
        }
        next();
    };
};
```

### In Routes:
```javascript
// Only managers and admins can approve
router.post('/approvals/:id/approve', 
    authenticateToken, 
    authorizeRoles('manager', 'admin'), 
    approveHandler
);

// Only auditors and above can view logs
router.get('/logs', 
    authenticateToken, 
    authorizeRoles('auditor', 'manager', 'admin'), 
    logsHandler
);
```

---

## Test Users in Your System

| Username | Password | Role | Best For Testing |
|----------|----------|------|------------------|
| `teller1` | `password123` | Teller | Test daily limits, pending approvals |
| `manager1` | `password123` | Manager | Test approval workflow, overrides |
| `admin` | `password123` | Admin | Test full system access |
| `auditor1` | `password123` | Auditor | Test read-only access, reports |

---

## How to See the Differences

### Test 1: Login as Teller
- Try to create a $75,000 transfer
- **Result**: Goes to pending, requires approval
- **Approvals menu**: Not visible

### Test 2: Login as Manager
- Try to create a $75,000 transfer
- **Result**: Completes immediately
- **Approvals menu**: Visible, can approve others' transfers

### Test 3: Login as Admin
- Can do everything managers can do
- Plus additional system administration (if implemented)

### Test 4: Login as Auditor
- Can view all transactions and logs
- **Cannot** create any transactions
- Good for reviewing/reporting only

---

## Summary

**The 4 roles are NOT the same!** They implement different security levels:

1. **Teller**: Basic operations, limited by daily limits
2. **Manager**: Supervisory role, can approve and override
3. **Admin**: Full system control
4. **Auditor**: Read-only access for compliance

This role-based access control (RBAC) is a **banking industry standard** and critical for:
- Security
- Compliance
- Fraud prevention
- Audit trails
- Regulatory requirements

---

**Your system correctly implements enterprise-grade role-based security!** 🔒
