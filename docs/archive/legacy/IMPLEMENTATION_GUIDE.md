# Auth & Member Management Implementation - Invariants & Enforcement

## Implementerade komponenter

### Frontend Types (`frontend/src/types/`)

- **auth.ts**: `AuthState`, `StudioSession`, `MemberSession`, `AuthContext`
- **studio.ts**: `Studio`, `StudioWithMembers`
- **member.ts**: `Member`, `PermissionFlags`, `MemberRole`, Owner-immutability helpers

### Backend Entities (`backend/src/platform/entities/`)

- **studio-member.entity.ts**: Uppdaterad med `isOwner`, `permissionsMask` (BIGINT), `gameAccessIds` (UUID[])
- **PermissionBitMask enum**: Binary representation av permissions

### Backend Service (`backend/src/platform/studio-member.service.ts`)

- Tydlig API: `createMember()`, `updateMember()`, `deleteMember()`, `promoteToOwner()`
- Helpers: `isOwner()`, `assertTargetNotOwner()`, `assertNotLastOwner()`
- Bootstrap: `createBootstrapOwner()` auto-skapas vid studio-creation

### Backend Integration

- **PlatformModule**: Registrerar `StudioMemberService`
- **UsersService**: Använder bootstrap-metod vid signup och login auto-migration
- **UsersModule**: Importerar PlatformModule för dependency injection

---

## KONTROLLERADE INVARIANTS

### 1. Owner-Immutability (ENFORCED)

**Regel**: En Owner-medlem kan ALDRIG modifieras av någon annan (inte ens en annan Owner)

**Enforcement**:

- Method: `StudioMemberService.assertTargetNotOwner(target)`
- Kastade i: `updateMember()`, `deleteMember()`
- Resultat: `ForbiddenException` 403

**Test-case**:

```
Actor: Owner A
Target: Owner B
Action: updateMember(A, B.id, {...})
Result: ForbiddenException("Cannot modify Owner members...")
```

---

### 2. Minimum One Owner per Studio (ENFORCED)

**Regel**: En Studio måste ALLTID ha minst en Owner. Ingen operation får resultera i 0 Owners.

**Enforcement**:

- Method: `StudioMemberService.assertNotLastOwner(studioId, targetMemberId?)`
- Kastade i: `deleteMember()` (kontrollerar innan radering)
- Resultat: `BadRequestException` 400

**Test-case**:

```
Studio S has only Owner A
Actor: Owner A
Action: deleteMember(A, A.id) // Försöker radera sig själv
Result: BadRequestException("Studio must have at least one Owner...")
```

---

### 3. Only Owners Can Administer (ENFORCED)

**Regel**: Endast Owners får administrera andra members (skapa, uppdatera, radera).

**Enforcement**:

- Method: `StudioMemberService.assertIsOwner(actor)`
- Kastade i: `createMember()`, `updateMember()`, `deleteMember()`, `promoteToOwner()`
- Resultat: `ForbiddenException` 403

**Test-case**:

```
Actor: Member (non-Owner)
Action: createMember(member.id, {...})
Result: ForbiddenException("Only Owners can perform this action")
```

---

### 4. Only Owners Can Promote to Owner (ENFORCED)

**Regel**: Endast Owners får promovera nya Owners. Kan inte self-promote.

**Enforcement**:

- Method: `StudioMemberService.promoteToOwner(actorId, memberId)`
  - `assertIsOwner(actor)` - actor måste vara Owner
  - `if (target.isOwner)` throw - target kan inte redan vara Owner
- Resultat: `ForbiddenException` 403 eller `BadRequestException` 400

**Test-case**:

```
Actor: Admin (non-Owner)
Target: Regular Member
Action: promoteToOwner(admin.id, member.id)
Result: ForbiddenException("Only Owners can promote new Owners")
```

---

### 5. Same Studio Boundary (ENFORCED)

**Regel**: En admin kan inte administrera members från en annan studio.

**Enforcement**:

- Method: `StudioMemberService.assertSameStudio(actor, target)`
- Kastade i: `updateMember()`, `deleteMember()`, `promoteToOwner()`
- Resultat: `ForbiddenException` 403

**Test-case**:

```
Actor: Owner in Studio A
Target: Member in Studio B
Action: updateMember(actorA.id, targetB.id, {...})
Result: ForbiddenException("Cannot manage members from different studios")
```

---

### 6. Bootstrap Auto-Activation (ENFORCED)

**Regel**: Vid studio-skapande auto-skapas en Owner-medlem med alla permissions.

**Enforcement**:

- Method: `StudioMemberService.createBootstrapOwner(studio, user)`
  - Sätter `isOwner = true`
  - Sätter alla permission-bits: 31 (11111)
  - Sätter `gameAccessIds = []` (läggs till senare)
- Källa: `UsersService.signup()` och login auto-migration

**Garantier**:

- Nya studios startar omedelbar i state `Studio+MemberActive` (Owner auto-aktiv)
- Ingen "orphaned studio" utan Owner

---

### 7. Permission Bitmask Isolation (STRUCTURAL)

**Regel**: Permissions är lagrade som BIGINT bitmask. Inga två permissions kolliderar.

**Bitmask mappning**:

```
ManageMembers = 1 << 0 = 1 (00001)
ManageGames = 1 << 1 = 2 (00010)
ManageSettings = 1 << 2 = 4 (00100)
MintNFT = 1 << 3 = 8 (01000)
MakeTransactions = 1 << 4 = 16 (10000)
```

**Konvertering**:

- DB → App: `StudioMemberService.maskToFlags(mask: number)`
- App → DB: `StudioMemberService.flagsToMask(flags: object)`

---

### 8. Per-Game Access (STRUCTURAL)

**Regel**: Medlemmar har tillgång till specifika Games via UUID-array.

**Struktur**:

- DB: `gameAccessIds UUID[]` - native Postgres array
- Service: `StudioMemberService.hasGameAccess(member, gameId): boolean`
- Update: `updateMember(actor, memberId, { gameAccessIds: [...] })`

---

## MIGRATION GUIDE (Postgres)

```sql
-- Add new columns to studio_members
ALTER TABLE studio_members
ADD COLUMN is_owner BOOLEAN DEFAULT false,
ADD COLUMN permissions_mask BIGINT DEFAULT 0,
ADD COLUMN game_access_ids UUID[] DEFAULT ARRAY[]::uuid[];

-- Migrate existing OWNER role -> is_owner
UPDATE studio_members
SET is_owner = true
WHERE role = 'owner';

-- Migrate existing roles -> permissions_mask
UPDATE studio_members
SET permissions_mask = 31  -- All permissions (11111)
WHERE role = 'owner';

UPDATE studio_members
SET permissions_mask = 23  -- ManageMembers | ManageGames | MintNFT | MakeTransactions
WHERE role = 'admin';

UPDATE studio_members
SET permissions_mask = 0
WHERE role = 'member';

-- Verify at least one Owner per studio
-- (Run manually to verify before committing)
SELECT studio_id, COUNT(*) as owner_count
FROM studio_members
WHERE is_owner = true
GROUP BY studio_id;
```

---

## SÄKERHET & BEST PRACTICES

1. **Backend är källan till sanningen**
   - Frontend får dölja knappar baserat på permissions
   - Alla authorization-beslut tas i service-layer
   - Endpoints måste kontrollera permissions innan action

2. **No Double-Check Needed**
   - Om `StudioMemberService.updateMember()` returnerar utan exception → action godkänd
   - Exceptions är specifika (403 Forbidden vs 400 Bad Request)

3. **Idempotent Checks**
   - `promoteToOwner()` kastar om redan Owner (inte silent success)
   - `assertNotLastOwner()` checkad innan varje delete

4. **Audit Trail (Future)**
   - Lägg till `updatedBy: string` eller logs för Owner-ändringar
   - Tracka vem som promoverade nya Owners

---

## NÄSTA STEG (efter denna milestone)

1. ✅ **Punto 1-2**: Datamodell + entities (DONE)
2. ⏳ **Punto 3**: Session/state-hantering (React Context, localStorage)
3. ⏳ **Punto 4**: Route guards (Unauthenticated, StudioAuthenticated, Studio+MemberActive)
4. ⏳ **Punto 5**: UI-komponenter (Login, Dashboard, Members) med permission-checks
5. ⏳ **Punto 6**: Logout actions (studio logout vs member logout)

---

## FILER SKAPADE/ÄNDRADE

### Nya filer

- `frontend/src/types/auth.ts`
- `frontend/src/types/studio.ts`
- `frontend/src/types/member.ts`
- `backend/src/platform/studio-member.service.ts`

### Ändrade filer

- `backend/src/platform/entities/studio-member.entity.ts` (minimal update: +3 fields)
- `backend/src/platform/platform.module.ts` (register service)
- `backend/src/users/users.service.ts` (use StudioMemberService)
- `backend/src/users/users.module.ts` (import PlatformModule)

---

**Status**: ✅ Punkt 1-2 implementerad med full Owner-immutability enforcement
