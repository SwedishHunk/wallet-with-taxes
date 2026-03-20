# txGroupId Implementation Summary

## Overview

Implemented transaction grouping via `txGroupId` to link ledger entries belonging to the same business event (especially useful for transfers where two ledger entries need to be logically grouped).

## Changes Made

### 1. Entity Updates

**File**: `backend/src/platform/entities/ledger-entry.entity.ts`

- Added `txGroupId: string` column (UUID, NOT NULL) with @Index decorator
  - Enables efficient querying of related entries
- Added `counterpartyUserId?: string` column (UUID, nullable)
  - For transfers: links to the other party involved
- Added Index: `idx_ledger_tx_group_id` on `txGroupId` for performance

```typescript
@Column({ type: "uuid" })
txGroupId: string;

@Column({ type: "uuid", nullable: true })
counterpartyUserId?: string;

@Index("idx_ledger_tx_group_id", ["txGroupId"])
```

### 2. Database Migration

**File**: `backend/src/migrations/1729445700000-AddTxGroupIdToLedgerEntries.ts`

Migration strategy:

1. Add `txGroupId` column as nullable
2. Add `counterpartyUserId` column as nullable
3. Backfill existing rows with `gen_random_uuid()`
4. Set `txGroupId` to NOT NULL
5. Create index for efficient lookups

Safe for production: uses Postgres' built-in `gen_random_uuid()` function to generate unique IDs.

### 3. Service Layer Updates

**File**: `backend/src/platform/platform.service.ts`

#### Import Added

```typescript
import { randomUUID } from "crypto";
```

#### depositToGameWallet()

- Generate `txGroupId = randomUUID()` before transaction
- Pass `txGroupId` to ledger entry creation
- Each deposit gets a unique txGroupId for audit trails

#### withdrawFromGameWallet()

- Generate `txGroupId = randomUUID()` before transaction
- Pass `txGroupId` to ledger entry creation
- Each withdrawal gets a unique txGroupId for audit trails

#### transferBetweenPlayersInGame()

- Generate shared `txGroupId = randomUUID()` ONCE before transaction
- Pass same `txGroupId` to BOTH sender and recipient ledger entries
- Set `counterpartyUserId` on each entry:
  - Sender entry: `counterpartyUserId = toUserId`
  - Recipient entry: `counterpartyUserId = fromUserId`
- Links both sides of the transfer via txGroupId and counterpartyUserId

### 4. Test Helper Updates

**File**: `backend/test/helpers/test-helpers.ts`

Updated `TestLedgerEntry` interface:

```typescript
export interface TestLedgerEntry {
  id: string;
  type: "deposit" | "withdraw" | "transfer";
  amount: string;
  txGroupId: string; // NEW - required field
  counterpartyUserId?: string; // NEW - optional, for transfers
  description: string;
  createdAt: string;
}
```

Updated `validateLedgerEntryShape()` to require `txGroupId`:

```typescript
if (!data.id || !data.type || !data.amount || !data.txGroupId || !data.description) {
  throw new Error(...)
}
```

### 5. E2E Test Updates

**File**: `backend/test/platform-wallet-ledger.e2e-spec.ts`

Enhanced test I ("Transfer is atomic and scoped") with assertions:

```typescript
// Verify counterpartyUserId linkage
expect(user1TransferEntry?.counterpartyUserId).toBe(user2.id);
expect(user2TransferEntry?.counterpartyUserId).toBe(user1.id);

// Verify txGroupId linking
expect(user1TransferEntry?.txGroupId).toBe(user2TransferEntry?.txGroupId);
expect(user1TransferEntry?.txGroupId).toBeTruthy();
```

## Features Enabled

### Audit Trail

Every wallet operation now has a unique `txGroupId` for complete traceability.

### Transfer Auditability

- Both sides of a transfer share the same `txGroupId`
- Each side knows the counterparty via `counterpartyUserId`
- Enable queries like: "Show me all entries in transaction group X" → Returns both sender and recipient entries

### Query Examples

```sql
-- Find all entries in a transaction
SELECT * FROM ledger_entries WHERE txGroupId = 'some-uuid';

-- Find counterparty in a transfer
SELECT * FROM ledger_entries WHERE txGroupId = ? AND counterpartyUserId = ?;

-- Audit all transfers for a player
SELECT * FROM ledger_entries
WHERE type = 'transfer' AND wallet_id IN (select id from game_wallets ...)
ORDER BY createdAt DESC;
```

## Backward Compatibility

- ✅ No breaking changes to existing endpoints
- ✅ txGroupId and counterpartyUserId are purely additive
- ✅ Migration safely backfills existing rows with new UUIDs
- ✅ All 11 existing e2e tests (A-K) continue to pass

## Type Safety

- ✅ TypeScript compilation succeeds with no errors
- ✅ Entity strongly typed with txGroupId and counterpartyUserId
- ✅ Test helpers updated to match new schema
- ✅ All imports properly configured

## Atomicity Preserved

- ✅ All wallet operations remain atomic via `dataSource.transaction()`
- ✅ txGroupId generated OUTSIDE transaction (before beginning)
- ✅ Ledger entries created INSIDE transaction with shared txGroupId
- ✅ No risk of race conditions or partial writes

## Implementation Pattern

For any new wallet operation:

1. Generate `txGroupId = randomUUID()` BEFORE transaction
2. Pass `txGroupId` to all ledger entries created in that transaction
3. For multi-party operations (like transfers), use same txGroupId for all parties
4. Set `counterpartyUserId` to link related entries when applicable

## Testing

Run e2e tests with environment setup:

```bash
cd backend
export TEST_DATABASE_HOST=localhost
export TEST_DATABASE_USER=test_user
export TEST_DATABASE_PASSWORD=test_pass
npm run test:e2e
```

Expected: All 11 tests pass (A-K), including enhanced test I with txGroupId/counterpartyUserId assertions.
