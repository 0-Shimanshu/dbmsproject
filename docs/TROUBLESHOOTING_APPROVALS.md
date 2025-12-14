# 🔧 Troubleshooting Guide: Approvals Page Issues

## Problem Summary
The Approvals page was showing "Loading pending approvals..." indefinitely and not displaying any data, even when pending approvals existed in the database.

## Root Causes Identified

### 1. **JavaScript Function Reference Errors**
- **Issue**: `approvals.js` was calling `formatCurrency()` and `formatDateTime()` as global functions
- **Fix**: Changed to `Utils.formatCurrency()` and `Utils.formatDateTime()`

### 2. **Toast Notification Function Missing**
- **Issue**: `approvals.js` was calling undefined `showNotification()` function
- **Fix**: Changed all instances to `Toast.error()` and `Toast.success()`

### 3. **User Context Not Passed Correctly**
- **Issue**: `app.js` was passing `this.user` (undefined) instead of `Auth.currentUser`
- **Fix**: Changed to `Auth.currentUser` in the Approvals initialization

### 4. **Token Expiration/Invalid Token**
- **Issue**: The authentication token stored in localStorage was invalid or expired
- **Fix**: Users need to logout and login again to get a fresh token

## Files Modified

### ✅ `client/js/app.js`
```javascript
// BEFORE:
case 'approvals':
    await Approvals.init(this.user);
    break;

// AFTER:
case 'approvals':
    await Approvals.init(Auth.currentUser);
    break;
```

### ✅ `client/js/approvals.js`
Multiple changes:
1. **Utility Functions** - Changed all instances:
   - `formatCurrency()` → `Utils.formatCurrency()`
   - `formatDateTime()` → `Utils.formatDateTime()`

2. **Toast Notifications** - Changed all instances:
   - `showNotification('message', 'error')` → `Toast.error('Error', 'message')`
   - `showNotification('message', 'success')` → `Toast.success('Success', 'message')`

## How to Test & Verify

### Step 1: Use the Debug Page
1. Open: http://localhost:3000/debug.html
2. Check if token exists in localStorage
3. If token is expired or invalid, proceed to Step 2

### Step 2: Clear Cache and Login
1. **Option A - Use Debug Page:**
   - Click "Clear LocalStorage" button
   - Go back to main page: http://localhost:3000
   - Login again

2. **Option B - Browser DevTools:**
   - Press F12 to open DevTools
   - Go to "Application" tab → "Local Storage"
   - Delete `token` and `user` entries
   - Refresh page and login

3. **Option C - Logout Button:**
   - Click the "Logout" button in the sidebar
   - Login again

### Step 3: Test the Approvals Page
1. **Login as Manager or Admin:**
   - Username: `manager1` or `admin`
   - Password: `password123`

2. **Navigate to Approvals:**
   - Click "Approvals" in the sidebar
   - You should now see the pending approvals table

3. **Verify Pending Approvals:**
   - Check that the table shows pending transfers
   - Verify "Approve" and "Reject" buttons are visible
   - Try approving or rejecting a transfer

### Step 4: Check Browser Console
If still having issues:
1. Press F12 → Go to "Console" tab
2. Look for any error messages
3. Check for debug logs starting with "[Approvals]"

## Verification Checklist

✅ **Backend API Working:**
```powershell
# Test login
$body = @{username="manager1";password="password123"} | ConvertTo-Json
$response = Invoke-RestMethod -Uri "http://localhost:3000/api/auth/login" -Method POST -Body $body -ContentType "application/json"
$token = $response.data.token

# Test pending approvals
$headers = @{Authorization="Bearer $token"}
Invoke-RestMethod -Uri "http://localhost:3000/api/approvals/pending" -Method GET -Headers $headers
```

✅ **Database Has Pending Approvals:**
```sql
SELECT * FROM pending_approvals WHERE status = 'pending';
```

✅ **Frontend Files Updated:**
- [x] `client/js/app.js` - User context passed correctly
- [x] `client/js/approvals.js` - Utility functions fixed
- [x] `client/js/approvals.js` - Toast notifications fixed

## Common Issues & Solutions

### Issue: "Invalid or expired token"
**Solution:** Login again to get a fresh token

### Issue: "Access Denied" message
**Solution:** Make sure you're logged in as `manager` or `admin` role

### Issue: "No pending approvals" message
**Solution:** 
1. Check database: `SELECT * FROM pending_approvals WHERE status = 'pending';`
2. If empty, create a test transfer as teller that exceeds daily limit

### Issue: Approvals page not loading at all
**Solution:**
1. Check browser console for errors
2. Verify server is running: `http://localhost:3000`
3. Clear browser cache and localStorage

### Issue: Functions not defined errors
**Solution:** Make sure all JS files are loaded in correct order in `index.html`:
```html
<script src="js/api.js"></script>
<script src="js/utils.js"></script>
<script src="js/auth.js"></script>
<!-- ... other modules ... -->
<script src="js/approvals.js"></script>
<script src="js/app.js"></script>
```

## Testing the Approval Workflow

### Create a Pending Approval (as Teller)
1. Login as `teller1` / `password123`
2. Go to "Transactions" page
3. Click "Transfer" button
4. Enter:
   - From Account: 10010010
   - To Account: 10020014
   - Amount: $6000 (exceeds daily limit of $5000)
5. Submit - This will create a pending approval

### Approve/Reject Transfer (as Manager)
1. Logout and login as `manager1` / `password123`
2. Go to "Approvals" page
3. See the pending transfer
4. Click "Approve" or "Reject"
5. Verify the transaction is processed/rejected

## Debug Tools

### Browser Console Commands
```javascript
// Check current user
console.log(Auth.currentUser);

// Check token
console.log(localStorage.getItem('token'));

// Test API call
Api.get('/api/approvals/pending').then(console.log);

// Force reload approvals
Approvals.init(Auth.currentUser);
```

### Database Queries
```sql
-- Check pending approvals
SELECT * FROM pending_approvals WHERE status = 'pending';

-- Check recent transfers
SELECT * FROM transactions WHERE type = 'transfer' ORDER BY created_at DESC LIMIT 10;

-- Check users and roles
SELECT user_id, username, full_name, role, is_active FROM users;
```

## Expected Behavior

### ✅ Correct Behavior:
1. **For Teller Users:**
   - "Approvals" menu item is hidden
   - Transfers exceeding daily limit create pending approvals
   - Dashboard shows "Transfer pending approval" message

2. **For Manager/Admin Users:**
   - "Approvals" menu item is visible
   - Pending Approvals page shows all pending transfers
   - Can approve or reject transfers
   - Dashboard shows pending approvals count

3. **For Auditor Users:**
   - "Approvals" menu item is hidden
   - Read-only access to all data

## Next Steps

If issues persist after following this guide:
1. Check server logs for errors
2. Verify database connectivity
3. Test API endpoints using the debug page
4. Review browser console for JavaScript errors
5. Ensure all code changes were saved and server was restarted

## Quick Fix Summary

**If you're seeing "Invalid or expired token":**
1. Logout (or clear localStorage)
2. Login again
3. Navigate to Approvals page
4. Should work now! ✅

---

Last Updated: December 14, 2025
Version: 1.0
