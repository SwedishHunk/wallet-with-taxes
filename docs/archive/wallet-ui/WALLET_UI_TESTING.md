# Game Wallet UI - Testing & Verification Guide

## Prerequisites
- Backend running on http://localhost:3000
- Frontend running on http://localhost:5173
- Authenticated user with studio and game selected
- Studio has at least 2 members (for transfer testing)

## Testing Checklist

### ✓ Component Rendering

- [ ] Navigate to Dashboard
- [ ] Verify game is selected (activeGame exists)
- [ ] WalletInfo component appears below member info section
- [ ] Component renders without console errors

### ✓ Wallet Summary Display

- [ ] Wallet summary section appears
- [ ] Three cards show: Balance, Total Deposited, Total Withdrawn
- [ ] Values are displayed as strings (e.g., "100.00000000")
- [ ] Cards have correct background colors:
  - Balance: Blue (bg-blue-50)
  - Deposited: Green (bg-green-50)
  - Withdrawn: Orange (bg-orange-50)

### ✓ Forms Render

- [ ] Three forms appear side-by-side (on desktop):
  1. Deposit Form (Blue button)
  2. Withdraw Form (Orange button)
  3. Transfer Form (Purple button)
- [ ] All form inputs are visible
- [ ] All buttons are clickable

#### Deposit Form
- [ ] "Amount" input present
- [ ] "Description (optional)" input present
- [ ] "Deposit" button present and blue

#### Withdraw Form
- [ ] "Amount" input present
- [ ] "Description (optional)" input present
- [ ] "Withdraw" button present and orange

#### Transfer Form
- [ ] "Recipient" dropdown present
- [ ] "Amount" input present
- [ ] "Description (optional)" input present
- [ ] "Transfer" button present and purple

### ✓ Member Dropdown Population

- [ ] Click "Recipient" dropdown in Transfer form
- [ ] List appears with all studio members
- [ ] Each member shows their email
- [ ] Can select a member
- [ ] Selected value persists

### ✓ Client-Side Validation

#### Amount Validation
- [ ] Entering "0" in Amount field allows form submission
  - Expected: Form submission prevented, error shown: "Amount must be greater than 0"
  - Actual: _______
  
- [ ] Entering negative number (e.g., "-10") in Amount field
  - Expected: Error shown when submitting
  - Actual: _______
  
- [ ] Entering "abc" in Amount field
  - Expected: Error shown when submitting
  - Actual: _______
  
- [ ] Entering valid amount (e.g., "100") in Amount field
  - Expected: Validation passes, form can submit
  - Actual: _______

#### Transfer-Specific Validation
- [ ] Try to submit transfer without selecting recipient
  - Expected: Error shown: "Select a recipient"
  - Actual: _______
  
- [ ] Select recipient and try to submit
  - Expected: Form can submit
  - Actual: _______

### ✓ Deposit Transaction

**Setup:** Wallet has some starting balance

**Test Steps:**
1. [ ] Enter amount (e.g., "50") in Deposit Amount field
2. [ ] Enter description (e.g., "Test deposit") in Description field
3. [ ] Click "Deposit" button
4. [ ] Button shows "Depositing..." text
5. [ ] Button becomes disabled
6. [ ] Wait for response

**Expected Results:**
- [ ] Success message appears: "Deposit successful!"
- [ ] Amount input cleared
- [ ] Description input cleared
- [ ] Wallet summary updates:
  - Balance increases by deposited amount
  - Total Deposited increases by deposited amount
- [ ] New entry appears in ledger:
  - Type: "deposit"
  - Amount: "50.00000000"
  - Description: "Test deposit"
  - Has txGroupId
  - Timestamp shows current time
- [ ] Success message disappears after 3 seconds

### ✓ Withdraw Transaction

**Setup:** Wallet has sufficient balance (> withdraw amount)

**Test Steps:**
1. [ ] Enter amount (e.g., "25") in Withdraw Amount field
2. [ ] Enter description (e.g., "Test withdrawal") in Description field
3. [ ] Click "Withdraw" button
4. [ ] Button shows "Withdrawing..."
5. [ ] Wait for response

**Expected Results:**
- [ ] Success message appears: "Withdrawal successful!"
- [ ] Amount input cleared
- [ ] Description input cleared
- [ ] Wallet summary updates:
  - Balance decreases by withdrawn amount
  - Total Withdrawn increases by withdrawn amount
- [ ] New entry appears in ledger:
  - Type: "withdraw"
  - Amount: "25.00000000"
  - Description: "Test withdrawal"
  - Has txGroupId
  - Timestamp shows current time

### ✓ Withdraw - Insufficient Balance

**Setup:** Wallet balance < attempted withdrawal

**Test Steps:**
1. [ ] Enter amount (e.g., "999999") that exceeds balance
2. [ ] Click "Withdraw" button
3. [ ] Wait for response

**Expected Results:**
- [ ] Error message appears (from backend)
- [ ] Error likely: "Insufficient balance"
- [ ] Form retains entered values (not cleared)
- [ ] Wallet summary unchanged
- [ ] No new entry in ledger

### ✓ Transfer Transaction

**Setup:**
- Wallet has sufficient balance
- At least one other member in studio

**Test Steps:**
1. [ ] Select recipient from dropdown (e.g., "user2@example.com")
2. [ ] Enter amount (e.g., "15") in Amount field
3. [ ] Enter description (e.g., "Test transfer") in Description field
4. [ ] Click "Transfer" button
5. [ ] Button shows "Transferring..."
6. [ ] Wait for response

**Expected Results:**
- [ ] Success message appears: "Transfer successful!"
- [ ] Form inputs cleared
- [ ] Wallet summary updates:
  - Balance decreases by transferred amount
  - Total Withdrawn increases by transferred amount
- [ ] TWO new entries appear in ledger:
  - **Sender Entry:**
    - Type: "transfer"
    - Amount: "15.00000000"
    - Description: "Test transfer"
    - counterpartyUserId: (recipient's userId, first 8 chars visible)
    - txGroupId: "abc123de..." (first 8 chars shown)
  - **Recipient Entry:** (appears in their ledger when they refresh)
    - Type: "transfer"
    - Amount: "15.00000000"
    - Description shows recipient perspective
    - counterpartyUserId: (sender's userId)
    - **Same txGroupId** as sender entry
- [ ] Both entries grouped by txGroupId

### ✓ Transfer - Invalid Recipient

**Test Steps:**
1. [ ] Don't select recipient (leave as "Select member...")
2. [ ] Enter amount and description
3. [ ] Click "Transfer" button

**Expected Results:**
- [ ] Error shown: "Select a recipient"
- [ ] Form not submitted
- [ ] Wallet unchanged

### ✓ Transfer - Self

**Test Steps:**
1. [ ] Select current user as recipient (if possible)
2. [ ] Enter amount
3. [ ] Click "Transfer"

**Expected Results:**
- [ ] Error from backend: "Cannot transfer to yourself"
- [ ] Form retains values

### ✓ Ledger Grouping by txGroupId

**Test Steps:**
1. [ ] Do multiple deposits and withdrawals
2. [ ] Do a transfer (creates 2 entries)
3. [ ] Scroll down to ledger section

**Expected Results:**
- [ ] Each unique txGroupId shown as a separate group
- [ ] Each group shows all entries belonging to that transaction
- [ ] Transfer shows both sender and recipient entries grouped together
- [ ] Each group shows truncated txGroupId (first 8 chars + "...")

### ✓ Error Handling

#### Network Error
- [ ] Disable internet/network while submitting form
- [ ] Expected: Error message appears (axios error)

#### API Error (Backend Returns Error)
- [ ] Try to withdraw more than balance
- [ ] Expected: Error message from backend response.data.message

#### Missing ActiveGame
- [ ] Navigate to game selector, deselect game
- [ ] Return to dashboard
- [ ] Expected: "Välj ett spel först" message

#### Not Authenticated
- [ ] Log out
- [ ] Expected: "Not authenticated" message

### ✓ Messages

#### Success Message
- [ ] Text color: Green
- [ ] Background: Green (bg-green-50)
- [ ] Contains checkmark or success text
- [ ] Disappears after 3 seconds
- [ ] **Known Issue:** May appear multiple times if multiple rapid submissions

#### Error Message
- [ ] Text color: Red
- [ ] Background: Red (bg-red-50)
- [ ] Shows error text from API or client validation
- [ ] Persists until next action (not auto-dismissing)

### ✓ Loading & Disabled States

- [ ] During initial load:
  - Wallet shows "Loading wallet..."
  - Forms visible but can submit
  
- [ ] During deposit submission:
  - "Deposit" button shows "Depositing..." and disabled
  - Amount and Description inputs disabled
  - Other forms clickable
  
- [ ] During withdraw submission:
  - "Withdraw" button shows "Withdrawing..." and disabled
  - Amount and Description inputs disabled
  - Other forms clickable
  
- [ ] During transfer submission:
  - "Transfer" button shows "Transferring..." and disabled
  - Recipient, Amount, Description inputs disabled
  - Other forms clickable

### ✓ Refresh & Persistence

- [ ] Complete a transaction
- [ ] Refresh browser (F5)
- [ ] Expected: Wallet data reloaded, transaction still visible in ledger

- [ ] Navigate away from dashboard
- [ ] Navigate back to dashboard (same game)
- [ ] Expected: Wallet data reloaded, all transactions visible

### ✓ Multiple Games

**If setup supports multiple games:**

- [ ] Select Game A
- [ ] Do a deposit in Game A
- [ ] Switch to Game B
- [ ] Expected: Game B wallet shows different balance/ledger
- [ ] Switch back to Game A
- [ ] Expected: Game A shows transaction still there

### ✓ Responsive Layout

#### Desktop (1920px+)
- [ ] Three forms in one row side-by-side
- [ ] Wallet summary full width above
- [ ] Ledger full width below

#### Tablet (768px - 1024px)
- [ ] Forms may reflow to 2 columns

#### Mobile (< 768px)
- [ ] All forms stack vertically
- [ ] All sections full width
- [ ] Still functional
- [ ] No horizontal scrolling needed

### ✓ Type Safety

- [ ] No TypeScript errors in browser console
- [ ] No "Cannot read property..." errors
- [ ] No "undefined is not a function" errors

### ✓ Performance

- [ ] Forms are responsive (no lag when typing)
- [ ] Buttons provide immediate visual feedback
- [ ] Ledger renders smoothly even with many transactions
- [ ] No memory leaks in browser DevTools

## Browser Console Checks

Run in browser console to verify state:
```javascript
// Check if component is mounted
document.querySelector('[class*="WalletInfo"]')

// Check for errors in console
// Should see no red error messages

// Check network tab in DevTools
// Verify API calls:
// - GET /platform/games/:gameId/wallet
// - GET /platform/games/:gameId/wallet/ledger
// - GET /studios/:studioId/members
// - POST /platform/games/:gameId/wallet/deposit
// - POST /platform/games/:gameId/wallet/withdraw
// - POST /platform/games/:gameId/wallet/transfer
```

## Test Data Requirements

### Minimum Setup
- 1 Studio
- 1 Game in studio
- 2 Members in studio (for transfer testing)
- 1 Member logged in with permissions

### Recommended Setup for Full Testing
- 1 Studio
- 2 Games in studio
- 3+ Members in studio
- One member logged in
- 1 other member to test transfers

## Known Issues & Limitations

- [ ] Success message auto-dismisses but error doesn't (by design)
- [ ] No pagination for large ledger lists
- [ ] No transaction filtering or search
- [ ] Member dropdown not searchable (could add filtering)
- [ ] No undo/rollback after transaction
- [ ] Ledger does not show running balance

## Regression Testing (After Each Code Change)

1. [ ] Can deposit successfully
2. [ ] Can withdraw successfully
3. [ ] Can transfer successfully
4. [ ] Wallet summary updates correctly
5. [ ] Ledger groups by txGroupId
6. [ ] Error messages display
7. [ ] Form validation works
8. [ ] Member dropdown populates
9. [ ] No console errors
10. [ ] No TypeScript errors

## Sign-Off

- [ ] All critical tests pass
- [ ] No blocking bugs found
- [ ] UI renders cleanly
- [ ] Forms are functional
- [ ] Errors handled gracefully
- [ ] Ready for production

**Tester Name:** ________________

**Date:** ________________

**Notes:** ________________
