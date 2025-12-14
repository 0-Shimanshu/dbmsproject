# Testing Guide - Banking Management System

## Quick Start Testing Checklist

### ✅ Pre-Test Setup
- [ ] MySQL server is running
- [ ] Database `banking_system` created and schema imported
- [ ] Backend server running on http://localhost:3000
- [ ] Browser open at http://localhost:3000

### ✅ Login Testing
Test all user roles:
- [ ] **Admin** (admin / password123) - Full access
- [ ] **Manager** (manager1 / password123) - Management access
- [ ] **Teller** (teller1 / password123) - Transaction access
- [ ] **Auditor** (auditor1 / password123) - View-only access

### ✅ Dashboard Testing
- [ ] Dashboard loads with statistics
- [ ] Shows correct counts (customers, accounts, transactions)
- [ ] Displays total balance
- [ ] Recent transactions table populated
- [ ] Statistics are accurate

### ✅ Accounts Module Testing
- [ ] View all accounts (should show pre-loaded sample accounts)
- [ ] Filter by account type (Savings, Checking, Business)
- [ ] Filter by status (Active, Suspended, Closed)
- [ ] Create new account:
  - [ ] Select customer (Alice Johnson, Bob Smith, Charlie Brown)
  - [ ] Choose account type
  - [ ] Set initial deposit ($1000+)
  - [ ] Verify account appears in list
- [ ] Update account details (click account card)
- [ ] Close account (status changes to Closed)

### ✅ Transactions Module Testing
- [ ] View all transactions (pre-loaded sample data)
- [ ] Filter by transaction type (Deposit, Withdrawal, Transfer)
- [ ] Filter by status (Pending, Completed, Failed, Reversed)
- [ ] **Deposit Transaction**:
  - [ ] Select account
  - [ ] Enter amount ($100+)
  - [ ] Add description
  - [ ] Verify balance increases
  - [ ] Check transaction appears in list
- [ ] **Withdrawal Transaction**:
  - [ ] Select account with sufficient balance
  - [ ] Enter amount (less than balance)
  - [ ] Verify balance decreases
  - [ ] Check transaction appears
- [ ] **Transfer Transaction**:
  - [ ] Select source account (with funds)
  - [ ] Select different destination account
  - [ ] Enter amount
  - [ ] Verify both balances update correctly
  - [ ] Check TWO transactions appear (debit and credit)

### ✅ Reversals Module Testing
- [ ] View all reversals
- [ ] Click "Reverse Transaction" on completed transaction
- [ ] Enter reversal reason
- [ ] Verify:
  - [ ] Original transaction status = Reversed
  - [ ] New reversal record created
  - [ ] Balance reverted to previous state
  - [ ] Audit log entry created

### ✅ Audit Logs Testing
- [ ] View all system logs
- [ ] Filter by action type:
  - [ ] LOGIN
  - [ ] ACCOUNT_CREATE
  - [ ] TRANSACTION
  - [ ] REVERSAL
- [ ] Filter by user
- [ ] Verify logs show:
  - [ ] Timestamp
  - [ ] User
  - [ ] Action
  - [ ] Details
  - [ ] IP address

### ✅ Reports Module Testing
- [ ] **Daily Transaction Summary**:
  - [ ] Select date range
  - [ ] Click "Generate Daily Summary"
  - [ ] Verify shows:
    - Total transactions
    - Total deposits
    - Total withdrawals
    - Net balance change
- [ ] **Account Balance Report**:
  - [ ] Click "Generate Account Balances"
  - [ ] Verify all accounts listed with current balances
- [ ] **User Activity Report**:
  - [ ] Select date range
  - [ ] Click "Generate User Activity"
  - [ ] Verify shows user actions count

### ✅ Simulation Module Testing
- [ ] View stuck transactions (should be empty initially)
- [ ] **Test Successful Transaction**:
  - [ ] Click "Simulate Successful Transaction"
  - [ ] Verify green success message appears
  - [ ] Check result details
- [ ] **Test Failed Transaction**:
  - [ ] Click "Simulate Failed Transaction"
  - [ ] Verify red failure message appears
  - [ ] Reason displayed
- [ ] **Test Stuck Transaction**:
  - [ ] Click "Simulate Stuck Transaction"
  - [ ] Verify orange stuck message
  - [ ] Stuck transaction appears in list
  - [ ] Click "Retry" on stuck transaction
  - [ ] Verify status changes to completed or failed
- [ ] Clear results and verify empty state

### ✅ Edge Cases & Error Testing
- [ ] **Insufficient Balance Withdrawal**:
  - Try to withdraw more than account balance
  - Verify error message shown
- [ ] **Invalid Transfer**:
  - Try to transfer to same account
  - Verify error message
- [ ] **Negative Amount**:
  - Try negative deposit/withdrawal
  - Verify validation error
- [ ] **Empty Forms**:
  - Submit forms with required fields empty
  - Verify validation messages
- [ ] **Session Expiration**:
  - Wait 24 hours (or change JWT_EXPIRE in .env to 1m for quick test)
  - Try to use the app
  - Verify redirect to login

### ✅ UI/UX Testing
- [ ] All navigation items work
- [ ] Active page highlighted in sidebar
- [ ] Modals open and close properly
- [ ] Toast notifications appear and disappear
- [ ] Tables are responsive
- [ ] Empty states show when no data
- [ ] Loading states show during API calls
- [ ] Forms validate input
- [ ] Error messages are clear
- [ ] Success messages confirm actions

### ✅ Data Integrity Testing
- [ ] Create account → Check database
  ```sql
  SELECT * FROM accounts ORDER BY created_at DESC LIMIT 1;
  ```
- [ ] Make deposit → Check transaction and balance
  ```sql
  SELECT * FROM transactions ORDER BY transaction_date DESC LIMIT 1;
  SELECT account_id, balance FROM accounts WHERE account_id = ?;
  ```
- [ ] Reverse transaction → Check reversal record
  ```sql
  SELECT * FROM transaction_reversals ORDER BY reversed_at DESC LIMIT 1;
  ```
- [ ] Check audit logs
  ```sql
  SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 10;
  ```

### ✅ Performance Testing
- [ ] Dashboard loads in < 2 seconds
- [ ] Transactions list loads quickly with many records
- [ ] Report generation completes reasonably
- [ ] Simulation runs without delays
- [ ] No console errors in browser DevTools (F12)
- [ ] No uncaught exceptions in server logs

## 🐛 Common Issues & Solutions

### Issue: Login fails
**Check**:
- Browser console for errors (F12)
- Server terminal for error messages
- Database connection is successful
- User credentials are correct (username: admin, password: password123)

### Issue: Dashboard shows 0 for all statistics
**Check**:
- Database has sample data: `SELECT COUNT(*) FROM accounts;`
- API endpoint works: Navigate to http://localhost:3000/api/dashboard/summary in browser
- Check server terminal for SQL errors

### Issue: Transactions not showing
**Check**:
- Sample data loaded: `SELECT COUNT(*) FROM transactions;`
- Filter settings (try "All" status)
- Browser console for JavaScript errors

### Issue: Balance not updating
**Check**:
- Transaction completed successfully (status = 'COMPLETED')
- Database trigger executed: Check `accounts.balance`
- Refresh the page to see updated data

### Issue: Page not loading
**Check**:
- Server is running on port 3000
- No other application using port 3000
- Access via http://localhost:3000 (not file://)
- Check browser console for 404 errors

## 📊 Expected Results

### Pre-loaded Data
After schema import, you should have:
- **4 Users**: admin, manager1, teller1, auditor1
- **3 Customers**: Alice Johnson, Bob Smith, Charlie Brown
- **6 Accounts**: 2 per customer (different types)
- **10+ Transactions**: Various deposits, withdrawals, transfers
- **Audit Logs**: Initial data creation logs

### Sample Balances (Initial)
- Account 1 (Alice - Savings): ~$5,000
- Account 2 (Alice - Checking): ~$2,500
- Account 3 (Bob - Savings): ~$10,000
- Account 4 (Bob - Business): ~$25,000
- Account 5 (Charlie - Checking): ~$3,500
- Account 6 (Charlie - Savings): ~$7,000

Total System Balance: ~$53,000

### Dashboard Statistics
- Total Customers: 3
- Total Accounts: 6
- Total Transactions: 10-15
- Total Balance: ~$53,000

## 🎯 Testing Priority

### High Priority (Must Test)
1. Login/Logout
2. Dashboard statistics
3. Create account
4. Deposit transaction
5. View transactions
6. Audit logs

### Medium Priority (Should Test)
1. Withdrawal transaction
2. Transfer between accounts
3. Transaction reversal
4. Reports generation
5. Account filters

### Low Priority (Nice to Test)
1. Update account
2. Close account
3. Simulation scenarios
4. Stuck transaction retry
5. Different user roles

## 📝 Test Report Template

```
# Test Report - Banking Management System

Date: _______________
Tester: _______________

## Environment
- OS: Windows
- Browser: _______________
- Node.js Version: _______________
- MySQL Version: _______________

## Test Results
| Module | Feature | Status | Notes |
|--------|---------|--------|-------|
| Auth | Login | ✅/❌ | |
| Dashboard | Statistics | ✅/❌ | |
| Accounts | Create | ✅/❌ | |
| Transactions | Deposit | ✅/❌ | |
| Transactions | Withdrawal | ✅/❌ | |
| Transactions | Transfer | ✅/❌ | |
| Reversals | Reverse | ✅/❌ | |
| Logs | View | ✅/❌ | |
| Reports | Daily Summary | ✅/❌ | |
| Simulation | Success | ✅/❌ | |

## Issues Found
1. 
2. 
3. 

## Overall Assessment
- Functionality: ___/10
- UI/UX: ___/10
- Performance: ___/10
- Data Integrity: ___/10

## Recommendations
1. 
2. 
3. 
```

## 🚀 Quick 5-Minute Test

If you have limited time, run this quick test:

1. **Login**: Use admin/password123
2. **Dashboard**: Verify statistics show numbers
3. **Accounts**: Click accounts, see list of 6 accounts
4. **Transaction**: Click transactions, click "New Deposit", select account, deposit $500, verify success
5. **Audit Logs**: Click logs, see your login and deposit logged

If all 5 steps work, the system is functioning correctly!

---

**Happy Testing! 🎉**
