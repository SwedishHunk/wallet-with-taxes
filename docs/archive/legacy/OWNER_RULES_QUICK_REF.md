## QUICK REFERENCE: Owner-Immutability Rules (UPDATED)

### Kontrollerade Invariants

| #   | Invariant                      | Policy                    | Enforcement                | HTTP |
| --- | ------------------------------ | ------------------------- | -------------------------- | ---- |
| 1   | Owner kan inte modifieras      | Immutable                 | `assertTargetNotOwner()`   | 403  |
| 2   | Min 1 Owner/Studio             | Required                  | `assertNotLastOwner()`     | 400  |
| 3   | ManageMembers tillåter admin   | ✅ Owner OR ManageMembers | `assertCanManageMembers()` | 403  |
| 4   | Promot till Owner = Owner only | Strict                    | `assertIsOwner()`          | 403  |
| 5   | Samma studio boundary          | Enforced                  | `assertSameStudio()`       | 403  |
| 6   | Bootstrap auto-creation        | Required                  | `createBootstrapOwner()`   | N/A  |

### Permission Policy - Vem kan göra vad?

```
┌─────────────────────────────────────┬──────────┬─────────────────┐
│ Åtgärd                              │ Owner    │ ManageMembers   │
├─────────────────────────────────────┼──────────┼─────────────────┤
│ createMember (non-Owner)            │ ✅ Yes   │ ✅ Yes          │
│ updateMember (non-Owner)            │ ✅ Yes   │ ✅ Yes          │
│ deleteMember (non-Owner)            │ ✅ Yes   │ ✅ Yes          │
│ promoteToOwner                      │ ✅ Yes   │ ❌ No (403)     │
│ Ändra Owner                         │ ❌ Blocked│ ❌ Blocked     │
│ Radera Owner                        │ ❌ Blocked│ ❌ Blocked     │
└─────────────────────────────────────┴──────────┴─────────────────┘
```

### Permission Bitmask

```typescript
ManageMembers = 1       // 00001
ManageGames = 2         // 00010
ManageSettings = 4      // 00100
MintNFT = 8             // 01000
MakeTransactions = 16   // 10000
─────────────────────────────────────
Owner = 31              // 11111 (all)
Member = 0              // 00000 (none)
Admin = 23              // 10111 (all except ManageSettings)
```

### Service API

```typescript
// Admin operations (actor must be Owner OR have ManageMembers)
createMember(actorId, studioId, dto) → StudioMember
updateMember(actorId, memberId, dto) → StudioMember   // Cannot target Owners
deleteMember(actorId, memberId) → void               // Cannot target Owners

// Owner-only
promoteToOwner(actorId, memberId) → StudioMember     // STRICT: Owner only

// Bootstrap
createBootstrapOwner(studio, user) → StudioMember

// Helpers
hasPermission(member, PermissionBitMask) → boolean
hasGameAccess(member, gameId) → boolean
maskToFlags(mask) → PermissionFlags
flagsToMask(flags) → number
```

### Frontend Permission Check

```typescript
// Use these helpers from member.ts
hasMemberPermission(member, "ManageMembers") → boolean
hasMemberGameAccess(member, gameId) → boolean
canMemberAdministerOther(actor, target, "delete") → boolean
```

### Key Files

**Frontend Types:**

- `frontend/src/types/auth.ts` - Session states
- `frontend/src/types/member.ts` - Permissions + Owner rules
- `frontend/src/types/studio.ts` - Studio interfaces

**Backend Services:**

- `backend/src/platform/studio-member.service.ts` - Enforcement + CRUD
- `backend/src/platform/entities/studio-member.entity.ts` - Columns: `isOwner`, `permissionsMask` (safe BIGINT), `gameAccessIds`

**Integration:**

- `backend/src/users/users.service.ts` - Uses `createBootstrapOwner()` on signup/login
