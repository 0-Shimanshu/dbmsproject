# UI Visibility by User Role

## What Each User Sees in the Navigation Menu

### 🔹 **Teller** (teller1)
```
📊 Dashboard          ✅ Visible
💳 Accounts           ✅ Visible  
💸 Transactions       ✅ Visible
✅ Approvals          ❌ HIDDEN (no permission)
↩️ Reversals          ❌ HIDDEN (no permission)
📋 Audit Logs         ✅ Visible (limited view)
📈 Reports            ✅ Visible (limited)
🧪 Simulation         ✅ Visible
```

**What Happens When Teller Creates Large Transfer**:
- Transfer > $50,000 → **Status: PENDING** ⏳
- Message: "Requires manager approval"
- Cannot see Approvals menu to approve it themselves
- Must wait for manager/admin

---

### 🔹 **Manager** (manager1)
```
📊 Dashboard          ✅ Visible
💳 Accounts           ✅ Visible
💸 Transactions       ✅ Visible
✅ Approvals          ✅ VISIBLE (can approve transfers)
↩️ Reversals          ✅ VISIBLE (can approve reversals)
📋 Audit Logs         ✅ Visible (full view)
📈 Reports            ✅ Visible (full)
🧪 Simulation         ✅ Visible
```

**What Happens When Manager Creates Large Transfer**:
- Transfer > $50,000 → **Status: COMPLETED** ✅
- No approval needed (override capability)
- Can approve other tellers' pending transfers
- Can request and approve reversals

---

### 🔹 **Admin** (admin)
```
📊 Dashboard          ✅ Visible
💳 Accounts           ✅ Visible
💸 Transactions       ✅ Visible
✅ Approvals          ✅ VISIBLE (can approve transfers)
↩️ Reversals          ✅ VISIBLE (can approve reversals)
📋 Audit Logs         ✅ Visible (full view)
📈 Reports            ✅ Visible (full)
🧪 Simulation         ✅ Visible
```

**What Happens When Admin Creates Large Transfer**:
- Transfer > $50,000 → **Status: COMPLETED** ✅
- No approval needed (full override)
- Same as manager, plus potential system config access
- Highest level of access

---

### 🔹 **Auditor** (auditor1)
```
📊 Dashboard          ✅ Visible (read-only)
💳 Accounts           ✅ Visible (read-only)
💸 Transactions       ✅ Visible (read-only)
✅ Approvals          ❌ HIDDEN (review only, no approval rights)
↩️ Reversals          ❌ HIDDEN (review only)
📋 Audit Logs         ✅ Visible (FULL ACCESS, all logs)
📈 Reports            ✅ Visible (full reporting)
🧪 Simulation         ❌ HIDDEN (cannot create test data)
```

**What Happens When Auditor Tries to Create Transfer**:
- **CANNOT** create transactions at all
- Forms are read-only or disabled
- Focused on reviewing and reporting
- Perfect for compliance checking

---

## Side-by-Side Comparison

| Feature | Teller | Manager | Admin | Auditor |
|---------|:------:|:-------:|:-----:|:-------:|
| Dashboard | ✅ | ✅ | ✅ | ✅ |
| Accounts | ✅ | ✅ | ✅ | ✅ View |
| Transactions | ✅ Create | ✅ Create | ✅ Create | ✅ View |
| **Approvals Menu** | ❌ | ✅ | ✅ | ❌ |
| **Reversals Menu** | ❌ | ✅ | ✅ | ❌ |
| Audit Logs | ✅ Limited | ✅ Full | ✅ Full | ✅ Full |
| Reports | ✅ Basic | ✅ Full | ✅ Full | ✅ Full |
| Simulation | ✅ | ✅ | ✅ | ❌ |

---

## Transaction Behavior by Role

### Creating a $75,000 Transfer

#### As **Teller**:
```
Step 1: Create transfer
Step 2: Submit
Result: ⏳ Status = PENDING
Message: "Transfer requires manager approval. Daily limit: $50,000. Total today: $X"
Action: Wait for manager to approve in Approvals page
```

#### As **Manager**:
```
Step 1: Create transfer
Step 2: Submit
Result: ✅ Status = COMPLETED
Message: "Transfer successful"
Action: Funds moved immediately, no approval needed
```

#### As **Admin**:
```
Step 1: Create transfer
Step 2: Submit
Result: ✅ Status = COMPLETED
Message: "Transfer successful"
Action: Funds moved immediately, no approval needed
```

#### As **Auditor**:
```
Step 1: Try to create transfer
Result: ❌ BLOCKED
Message: Form disabled or access denied
Action: Cannot create transactions
```

---

## Implementation in Code

### Navigation Filtering (client/js/app.js)

```javascript
// Hide navigation items based on user role
document.querySelectorAll('.nav-item[data-roles]').forEach(item => {
    const allowedRoles = item.dataset.roles.split(',');
    if (!allowedRoles.includes(this.user.role)) {
        item.style.display = 'none';  // Hide from tellers/auditors
    }
});
```

### Backend Authorization (server/routes/approvals.js)

```javascript
// Only managers and admins can access
router.get('/pending', 
    authenticateToken, 
    authorizeRoles('manager', 'admin'),  // Tellers blocked here
    async (req, res) => {
        // ... approval logic
    }
);
```

### Stored Procedure Logic (sql/schema.sql)

```sql
-- Check user role
SELECT role INTO v_user_role FROM users WHERE user_id = p_user_id;

-- If transfer exceeds daily limit AND user is teller
IF (v_daily_total + p_amount) > v_daily_limit AND v_user_role = 'teller' THEN
    -- Create pending approval
    SET p_status = 'pending';
ELSE
    -- Process immediately (manager/admin override)
    SET p_status = 'completed';
END IF;
```

---

## How to Test the Differences

### Test 1: Compare Teller vs Manager UI

1. **Open two browser windows side-by-side**
2. **Window 1**: Login as `teller1`
3. **Window 2**: Login as `manager1`
4. **Compare navigation menus**:
   - Teller: NO Approvals or Reversals menu
   - Manager: HAS Approvals and Reversals menu

### Test 2: Compare Transfer Behavior

1. **Window 1 (Teller)**: 
   - Create $75,000 transfer
   - See "Pending" status
2. **Window 2 (Manager)**:
   - Go to Approvals page
   - See the teller's pending transfer
   - Click Approve
3. **Window 1 (Teller)**:
   - Refresh transactions
   - See status changed to "Completed"

### Test 3: Test Manager Override

1. **Login as Manager** (`manager1`)
2. **Create $75,000 transfer**
3. **Result**: Completes immediately ✅
4. **No approval needed**

### Test 4: Test Auditor Read-Only

1. **Login as Auditor** (`auditor1`)
2. **Try to create transaction**
3. **Result**: Form disabled or access denied ❌
4. **Can view** all transactions and logs ✅

---

## Quick Reference

### Test Credentials

| Username | Password | Role | Use For |
|----------|----------|------|---------|
| `teller1` | `password123` | Teller | Test approval workflow |
| `manager1` | `password123` | Manager | Approve transfers |
| `admin` | `password123` | Admin | Full system access |
| `auditor1` | `password123` | Auditor | Read-only testing |

### Key Differences

1. **Navigation**: Different menus visible to different roles
2. **Transfer Limits**: Tellers blocked at $50k, managers unlimited
3. **Approval Rights**: Only managers/admins can approve
4. **Write Access**: Auditors have NO write access
5. **Override**: Managers/admins bypass daily limits

---

## Summary

**The roles are VERY different in functionality!**

- 🔵 **Teller**: Basic operations, approval required for large transfers
- 🟢 **Manager**: Supervisory role, can approve, override limits
- 🟠 **Admin**: Full control, system administration
- 🟣 **Auditor**: Read-only, compliance and reporting

**This implements proper banking security and compliance requirements!** 🏦🔒

Try logging in as different users to see the differences yourself at: http://localhost:3000
