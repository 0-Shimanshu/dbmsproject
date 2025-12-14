# Transfer Fail-Safe and Approval System

## Overview
The Banking Management System implements a comprehensive fail-safe mechanism for money transfers to ensure compliance with banking regulations and prevent unauthorized or excessive transactions.

## Daily Transfer Limits

### Configuration
- **Default Daily Limit**: $50,000.00 per account per day
- **Configurable**: The limit can be adjusted in the `system_config` table
- **Reset**: Limits reset daily at midnight

### How It Works
1. When a transfer is initiated, the system calculates the total amount already transferred from the source account today
2. If the new transfer would exceed the daily limit, the behavior depends on the user's role:
   - **Tellers**: Transfer is blocked and placed in pending approval queue
   - **Managers/Admins**: Transfer is processed immediately (override capability)

## Approval Workflow

### When Approval is Required
A transfer requires manager or admin approval when:
- The transfer amount + today's total transfers exceed the daily limit
- The initiating user is a teller (non-privileged user)

### Approval Process

#### 1. Transfer Initiation
```sql
CALL sp_transfer(
    from_account_id,
    to_account_id,
    amount,
    description,
    user_id,
    @transaction_id,
    @reference,
    @status,
    @message
);
```

**Possible Outcomes:**
- `status = 'completed'`: Transfer processed successfully (within limits or by manager/admin)
- `status = 'pending'`: Transfer requires approval (exceeds daily limit)
- `status = 'failed'`: Transfer failed (insufficient funds, frozen account, etc.)

#### 2. Pending Approval
When a transfer is pending:
- A record is created in the `pending_approvals` table
- The transaction is marked as `status = 'pending'`
- Funds are NOT held or transferred yet
- The requester receives a message indicating approval is needed

#### 3. Manager/Admin Review
Managers and admins can:
- View all pending approval requests
- See transfer details (amount, accounts, requester, reason)
- Approve or reject the transfer

#### 4. Approval Decision
```sql
CALL sp_approve_transfer(
    approval_id,
    approver_user_id,
    approve_boolean,
    rejection_reason,
    @status,
    @message
);
```

**Approval (approve = TRUE):**
- System re-validates account status and available balance
- Funds are held, debited from source, and credited to destination
- Transaction status changes: `pending → processing → completed`
- Both approval and transaction records are updated

**Rejection (approve = FALSE):**
- Transaction is marked as `failed`
- Rejection reason is recorded
- No funds are moved
- Requester can see the rejection reason in logs

## Database Structure

### Tables

#### `pending_approvals`
```sql
approval_id         INT PRIMARY KEY
transaction_id      INT (references transactions)
from_account_id     INT
to_account_id       INT
amount              DECIMAL(15, 2)
description         TEXT
requested_by        INT (user who initiated)
approved_by         INT (manager/admin who processed)
status              ENUM('pending', 'approved', 'rejected')
rejection_reason    TEXT
created_at          TIMESTAMP
processed_at        TIMESTAMP
```

#### `system_config`
```sql
config_key          VARCHAR(100)
config_value        TEXT
description         TEXT
```

Key configuration:
- `daily_transfer_limit`: Maximum daily transfer amount per account

### Stored Procedures

#### `sp_transfer`
Enhanced to check daily limits and create pending approvals when necessary.

**Key Logic:**
1. Validate accounts (exist, active, not same)
2. Check available balance (including overdraft)
3. Get daily transfer limit from config
4. Calculate today's total transfers from source account
5. Check if new transfer exceeds limit:
   - **YES + Teller**: Create pending approval → `status = 'pending'`
   - **YES + Manager/Admin**: Process immediately → `status = 'completed'`
   - **NO**: Process immediately → `status = 'completed'`

#### `sp_approve_transfer`
Processes approval or rejection of pending transfers.

**Permissions**: Only managers and admins can call this procedure

**Key Logic:**
1. Verify user has manager/admin role
2. Get approval details
3. Check approval is still pending
4. If rejecting:
   - Update approval status to 'rejected'
   - Update transaction status to 'failed'
   - Record rejection reason
5. If approving:
   - Re-validate accounts (still active?)
   - Re-check available balance
   - Process the transfer (hold → debit → credit)
   - Update approval status to 'approved'
   - Update transaction status to 'completed'

## API Endpoints

### Get Pending Approvals
```
GET /api/approvals/pending
Authorization: Bearer <token>
Roles: manager, admin

Response:
{
  "success": true,
  "data": [
    {
      "approval_id": 1,
      "transaction_id": 123,
      "reference_number": "TXN-20251214-001",
      "from_account_number": "1000000001",
      "from_holder_name": "John Doe",
      "to_account_number": "1000000002",
      "to_holder_name": "Jane Smith",
      "amount": 75000.00,
      "description": "Business payment",
      "requested_by_name": "Alice Teller",
      "created_at": "2025-12-14T10:30:00Z",
      "status": "pending"
    }
  ]
}
```

### Get Approval History
```
GET /api/approvals/history?limit=50&offset=0
Authorization: Bearer <token>
Roles: manager, admin

Response: Similar to pending approvals, but includes processed_at, approved_by_name, rejection_reason
```

### Process Approval
```
POST /api/approvals/:approvalId/process
Authorization: Bearer <token>
Roles: manager, admin

Request:
{
  "approve": true,  // or false to reject
  "rejectionReason": "Insufficient documentation"  // required if approve=false
}

Response:
{
  "success": true,
  "status": "completed",  // or "rejected"
  "message": "Transfer approved and completed successfully"
}
```

## Frontend Features

### Navigation
- **Approvals** menu item (visible only to managers and admins)
- Shows notification badge when pending approvals exist

### Approvals Page
Two tabs:
1. **Pending Approvals**: Active requests awaiting decision
2. **Approval History**: Previously processed requests

### Pending Approvals Tab
- Table showing all pending transfer requests
- Displays: reference, accounts, amount, requester, date
- Actions for each request:
  - **Approve** button: Processes the transfer immediately
  - **Reject** button: Prompts for rejection reason

### Approval History Tab
- Shows all previously approved or rejected transfers
- Displays: reference, accounts, amount, requester, processor, status, date
- Shows rejection reasons for rejected transfers

### Dashboard Integration
- **Pending Approvals** metric card
- Shows count of transfers awaiting approval
- Quick link to approvals page

## Security Features

1. **Role-Based Access Control**
   - Only managers and admins can view/process approvals
   - Tellers can initiate transfers but not approve them

2. **Audit Trail**
   - All approval actions are logged in `audit_logs`
   - Transaction history tracks state changes
   - Includes timestamps, user IDs, and reasons

3. **Re-validation on Approval**
   - Account status re-checked when processing approval
   - Available balance re-verified
   - Prevents stale or invalid approvals

4. **Transaction Atomicity**
   - All operations wrapped in database transactions
   - Rollback on any error
   - ACID compliance ensured

## Example Scenarios

### Scenario 1: Transfer Within Limit
- **User**: teller1
- **Amount**: $10,000
- **Today's Total**: $20,000
- **Daily Limit**: $50,000
- **Result**: Transfer processed immediately ✓

### Scenario 2: Transfer Exceeding Limit (Teller)
- **User**: teller1
- **Amount**: $60,000
- **Today's Total**: $20,000
- **Daily Limit**: $50,000
- **Result**: Transfer pending approval (total $80,000 > $50,000) ⏳

### Scenario 3: Transfer Exceeding Limit (Manager)
- **User**: manager1
- **Amount**: $60,000
- **Today's Total**: $20,000
- **Daily Limit**: $50,000
- **Result**: Transfer processed immediately (override) ✓

### Scenario 4: Approval Processing
- **Pending Transfer**: $60,000
- **Manager Action**: Approves
- **Account Status**: Active
- **Available Balance**: $100,000
- **Result**: Transfer completed successfully ✓

### Scenario 5: Approval with Insufficient Funds
- **Pending Transfer**: $60,000
- **Manager Action**: Approves
- **Account Status**: Active
- **Available Balance**: $40,000 (changed since request)
- **Result**: Approval rejected, transaction failed ✗

## Testing

### Test Daily Limit
1. Login as `teller1`
2. Navigate to Transactions
3. Create a transfer for $60,000 (assuming daily limit is $50,000)
4. Verify transaction status is `pending`
5. Check message mentions daily limit and approval requirement

### Test Approval Process
1. Login as `manager1` or `admin`
2. Navigate to Approvals
3. View pending approval from previous test
4. Click **Approve** or **Reject**
5. Verify transaction completes or fails accordingly
6. Check Approval History tab for record

### Test Manager Override
1. Login as `manager1`
2. Navigate to Transactions
3. Create a transfer for $60,000
4. Verify transaction completes immediately without approval

## Configuration

To change the daily transfer limit:
```sql
UPDATE system_config 
SET config_value = '100000.00' 
WHERE config_key = 'daily_transfer_limit';
```

To add additional limits or rules, extend the `sp_transfer` procedure with additional checks.

## Future Enhancements

1. **Account-Specific Limits**: Different limits per account type
2. **Weekly/Monthly Limits**: Cumulative limits over longer periods
3. **Risk Scoring**: Automated risk assessment for transfers
4. **Multi-Level Approval**: Require multiple approvers for very large amounts
5. **Notification System**: Email/SMS alerts for pending approvals
6. **Approval Expiration**: Auto-reject approvals older than X hours
7. **Velocity Checks**: Flag accounts with unusual transfer patterns

---

**Document Version**: 1.0  
**Last Updated**: December 14, 2025  
**Author**: Banking Management System Team
