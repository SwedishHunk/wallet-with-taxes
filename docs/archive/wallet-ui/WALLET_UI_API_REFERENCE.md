# Game Wallet UI - API Reference

## Backend Endpoints Used

All endpoints are already implemented in the backend. The frontend now has corresponding client-side wrappers.

### Wallet Endpoints

#### Get Game Wallet Balance
```
GET /platform/games/:gameId/wallet
```
**Frontend:** `getGameWallet(gameId: string)`

**Response:**
```json
{
  "id": "wallet-uuid",
  "balance": "100.00000000",
  "totalDeposited": "500.00000000",
  "totalWithdrawn": "400.00000000"
}
```

#### Get Game Wallet Ledger
```
GET /platform/games/:gameId/wallet/ledger
```
**Frontend:** `getGameWalletLedger(gameId: string)`

**Response:**
```json
[
  {
    "id": "entry-uuid",
    "type": "deposit",
    "amount": "100.00000000",
    "txGroupId": "group-uuid-1",
    "counterpartyUserId": null,
    "description": "Initial deposit",
    "createdAt": "2024-02-17T10:30:00Z"
  },
  {
    "id": "entry-uuid-2",
    "type": "transfer",
    "amount": "50.00000000",
    "txGroupId": "group-uuid-2",
    "counterpartyUserId": "user-2-uuid",
    "description": "Payment to user2",
    "createdAt": "2024-02-17T10:35:00Z"
  }
]
```

#### Deposit to Wallet
```
POST /platform/games/:gameId/wallet/deposit
Content-Type: application/json

{
  "amount": "100.00000000",
  "description": "Optional deposit description"
}
```
**Frontend:** `depositToWallet(gameId: string, amount: string, description?: string)`

**Response:** Updated GameWallet object

**Validation:**
- amount > 0
- amount is string (decimal format)

#### Withdraw from Wallet
```
POST /platform/games/:gameId/wallet/withdraw
Content-Type: application/json

{
  "amount": "50.00000000",
  "description": "Optional withdrawal description"
}
```
**Frontend:** `withdrawFromWallet(gameId: string, amount: string, description?: string)`

**Response:** Updated GameWallet object

**Validation:**
- amount > 0
- sufficient balance

#### Transfer Between Players
```
POST /platform/games/:gameId/wallet/transfer
Content-Type: application/json

{
  "toUserId": "recipient-user-id-uuid",
  "amount": "25.00000000",
  "description": "Optional transfer description"
}
```
**Frontend:** `transferBetweenPlayers(gameId: string, toUserId: string, amount: string, description?: string)`

**Response:** { fromWallet: GameWallet, toWallet: GameWallet }

**Validation:**
- amount > 0
- toUserId exists in studio
- sender has sufficient balance
- sender !== toUserId

### Studio Endpoints

#### Get Studio Members
```
GET /studios/:studioId/members
```
**Frontend:** `getStudioMembers(studioId: string)`

**Response:**
```json
[
  {
    "id": "member-uuid-1",
    "userId": "user-1-uuid",
    "email": "user1@example.com",
    ...other member fields
  },
  {
    "id": "member-uuid-2",
    "userId": "user-2-uuid",
    "email": "user2@example.com",
    ...other member fields
  }
]
```

Used to populate the transfer recipient dropdown.

## Frontend API Module Structure

### frontend/src/lib/platform.ts
```typescript
export const getGameWallet = (gameId: string) => ...
export const getGameWalletLedger = (gameId: string) => ...
export const depositToWallet = (gameId: string, amount: string, description?: string) => ...
export const withdrawFromWallet = (gameId: string, amount: string, description?: string) => ...
export const transferBetweenPlayers = (gameId: string, toUserId: string, amount: string, description?: string) => ...
```

### frontend/src/lib/users.ts
```typescript
export const getStudioMembers = (studioId: string) => ...
```

## Error Handling

All API calls use the existing `api` client from `frontend/src/lib/api.ts` which:
- Automatically includes Authorization header with JWT token
- Handles 401/403 by clearing session and redirecting to /login
- Propagates other errors as-is

Frontend catches errors and displays to user:
```typescript
try {
  await depositToWallet(gameId, amount, description);
} catch (err: any) {
  const msg = err?.response?.data?.message || "Deposit failed";
  setError(msg);
}
```

## Authentication

All endpoints require valid JWT token in `Authorization: Bearer <token>` header.
- Token is automatically added by `api.interceptors` in `frontend/src/lib/api.ts`
- Token is set via `setAuthToken()` after login
- Stored in localStorage as "token"

## Type Definitions (Frontend)

```typescript
interface GameWallet {
  id: string;
  balance: string;
  totalDeposited: string;
  totalWithdrawn: string;
}

interface LedgerEntry {
  id: string;
  type: "deposit" | "withdraw" | "transfer";
  amount: string;
  txGroupId: string;
  counterpartyUserId?: string;
  description?: string;
  createdAt: string;
}

interface StudioMember {
  id: string;
  userId: string;
  email: string;
}
```

## Amount Format

All amounts in API are:
- Strings (not numbers) to preserve precision
- Decimal format: "100.00000000" (8 decimal places)
- Positive only (no negative amounts)

Frontend treats amounts as strings throughout to maintain precision.

## Transaction Grouping (txGroupId)

- Each wallet operation generates a unique `txGroupId` on the backend
- For deposits/withdrawals: one entry per operation
- For transfers: TWO entries (sender + recipient) share the same `txGroupId`
- Frontend groups ledger display by `txGroupId` to show related transactions together
- For transfers: `counterpartyUserId` on each entry points to the other party

## Authorization & Scoping

- User can only access wallets for games they belong to
- User can only transfer to other members in their studio
- User can only withdraw if they have sufficient balance
- No manual userId entry - recipient must be selected from dropdown

## Rate Limiting

No explicit rate limiting on frontend - rely on backend constraints.

## Caching

Frontend does NOT cache wallet data. Each operation refreshes:
- `getGameWallet()` - always fresh from server
- `getGameWalletLedger()` - always fresh from server
- `getStudioMembers()` - loaded once on component mount, not refreshed

Consider adding caching/memoization for high-frequency access.
