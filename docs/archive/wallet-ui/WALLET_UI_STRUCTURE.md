# Game Wallet UI - Component Structure

## Component Hierarchy

```
Dashboard (index_dash.tsx)
├── PageHeader
├── Card (Member Info)
├── Card (Wallet Info)  ← NEW
│   └── WalletInfo (WalletInfo.tsx)
│       ├── Wallet Summary Section
│       │   ├── Balance Card
│       │   ├── Total Deposited Card
│       │   └── Total Withdrawn Card
│       ├── Forms Section (3-column grid)
│       │   ├── Deposit Form
│       │   ├── Withdraw Form
│       │   └── Transfer Form
│       ├── Messages (Error/Success)
│       └── Ledger Display Section
│           └── Transaction Groups (grouped by txGroupId)
```

## UI Layout

### Wallet Summary (Full Width)
```
┌─────────────────────────────────────────────┐
│ Wallet Summary                              │
├─────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │ Balance  │  │ Total    │  │ Total    │ │
│  │ 150.00   │  │ Dep.     │  │ With.    │ │
│  │          │  │ 300.00   │  │ 150.00   │ │
│  └──────────┘  └──────────┘  └──────────┘ │
└─────────────────────────────────────────────┘
```

### Forms (3-Column Grid)
```
┌──────────────────┬──────────────────┬──────────────────┐
│ Deposit          │ Withdraw         │ Transfer         │
├──────────────────┼──────────────────┼──────────────────┤
│ Amount:          │ Amount:          │ Recipient:       │
│ [_______]        │ [_______]        │ [Select user▼]   │
│                  │                  │                  │
│ Description:     │ Description:     │ Amount:          │
│ [_______]        │ [_______]        │ [_______]        │
│                  │                  │                  │
│ [Deposit]        │ [Withdraw]       │ Description:     │
│ (Blue button)    │ (Orange button)  │ [_______]        │
│                  │                  │                  │
│                  │                  │ [Transfer]       │
│                  │                  │ (Purple button)  │
└──────────────────┴──────────────────┴──────────────────┘
```

### Messages
```
Error (Red background):
┌─────────────────────────────────────────┐
│ ✗ Insufficient balance                  │
└─────────────────────────────────────────┘

Success (Green background):
┌─────────────────────────────────────────┐
│ ✓ Transfer successful!                  │
└─────────────────────────────────────────┘
```

### Transaction History (Full Width, Grouped by txGroupId)
```
┌─────────────────────────────────────────┐
│ Transaction History                     │
├─────────────────────────────────────────┤
│ TX Group: abc123de...                   │
│ ├─ Deposit        Initial deposit       │
│ │  100.00        Feb 17 10:30          │
│ └─────────────────────────────────────  │
│                                         │
│ TX Group: def456gh...                   │
│ ├─ Transfer       Payment to user2      │
│ │  50.00         Feb 17 10:35          │
│ │  Party: user-2-u...                  │
│ │                                       │
│ └─ Transfer       Received from user1   │
│    50.00         Feb 17 10:35          │
│    Party: user-1-u...                  │
└─────────────────────────────────────────┘
```

## Component States

### Loading
```
┌─────────────────────────────────────┐
│ Wallet Summary                      │
│ Loading wallet...                   │
└─────────────────────────────────────┘
```

### Submission
- Buttons show disabled state with opacity
- Shows "Depositing..." / "Withdrawing..." / "Transferring..."
- Other inputs disabled during submission

### Error
```
Error message appears in red alert box
Form inputs and buttons remain editable
User can retry
```

### Empty Ledger
```
┌─────────────────────────────────────┐
│ Transaction History                 │
│ No transactions yet                 │
└─────────────────────────────────────┘
```

## Responsive Design

- Desktop (3 columns for forms)
- Tablet (3 columns stack to 2)
- Mobile (All sections stack vertically)

Grid layout uses Tailwind: `grid grid-cols-1 md:grid-cols-3 gap-4`

## Form Validation (Client-Side)

### Deposit Form
- ✓ Amount must be > 0
- ✓ Description optional
- Error: "Deposit amount must be greater than 0"

### Withdraw Form
- ✓ Amount must be > 0
- ✓ Description optional
- Error: "Withdraw amount must be greater than 0"

### Transfer Form
- ✓ Recipient selected from dropdown
- ✓ Amount must be > 0
- ✓ Description optional
- Errors:
  - "Select a recipient"
  - "Transfer amount must be greater than 0"

## Colors & Styling

### Wallet Summary Cards
- Balance: Blue background (bg-blue-50)
- Deposited: Green background (bg-green-50)
- Withdrawn: Orange background (bg-orange-50)

### Form Buttons
- Deposit: Blue (bg-blue-600)
- Withdraw: Orange (bg-orange-600)
- Transfer: Purple (bg-purple-600)
- Hover: Darker shade (bg-[color]-700)
- Disabled: Opacity 50%

### Messages
- Error: Red background (bg-red-50), Red text (text-red-700)
- Success: Green background (bg-green-50), Green text (text-green-700)

### Ledger Entries
- Background: Light gray (bg-gray-50)
- Border: Normal
- Type: Capitalized, bold
- Description: Normal text
- Amount: Bold, right-aligned
- Timestamp: Small, gray, secondary text

## Interaction Flow

### Deposit Flow
1. User enters amount (validated real-time)
2. User optionally enters description
3. User clicks "Deposit"
4. Button shows "Depositing..." and disables
5. API call made with amount + description
6. On success:
   - Success message shown for 3 seconds
   - Wallet data refreshed
   - Form cleared
7. On error:
   - Error message shown
   - Form retains values
   - User can retry

### Withdraw Flow
(Same as Deposit)

### Transfer Flow
1. User selects recipient from dropdown (required)
2. User enters amount
3. User optionally enters description
4. User clicks "Transfer"
5. Same loading/success/error flow as above
6. On success:
   - Both sender and recipient see entries in their ledgers
   - Both entries share txGroupId
   - Each entry has counterpartyUserId

### Ledger Refresh
- Automatic after each successful transaction
- Manual refresh on component mount
- Manual refresh if user navigates away and back

## Data Flow

```
WalletInfo Component
  ├── useAuthState() → activeGame, studioId
  ├── useCallback(loadWalletData)
  │   ├── getGameWallet(activeGame.gameId)
  │   └── getGameWalletLedger(activeGame.gameId)
  │       ↓ Updates state: wallet, ledger
  ├── useCallback(loadMembers)
  │   └── getStudioMembers(studioId)
  │       ↓ Updates state: members
  ├── useEffect → runs on mount, activeGame change
  └── Form handlers
      ├── depositToWallet() → refresh
      ├── withdrawFromWallet() → refresh
      └── transferBetweenPlayers() → refresh
```

## State Management

### Initial State
```typescript
wallet: null
ledger: []
members: []
loading: false
error: null
successMsg: null
depositAmount: ""
depositDesc: ""
withdrawAmount: ""
withdrawDesc: ""
transferAmount: ""
transferToUser: ""
transferDesc: ""
submitting: null
```

### After Load
```typescript
wallet: { id, balance, totalDeposited, totalWithdrawn }
ledger: [
  { id, type, amount, txGroupId, counterpartyUserId?, description?, createdAt },
  ...
]
members: [
  { id, userId, email },
  ...
]
loading: false
```

### During Submission (e.g., deposit)
```typescript
submitting: "deposit" → Button shows "Depositing..."
```

### After Successful Submission
```typescript
wallet: updated
ledger: updated
submitting: null
successMsg: "Deposit successful!"
form: cleared (values reset to "")
```
