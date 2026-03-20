# Verifikation & Implementation: BIGINT + Route Guards + AppLayout

## ✅ ISSUE 1: BIGINT Framtidssäkerhet - LÖST

### Ändring

**Från:** `permissionsMask: number` (JS Number, precision loss)
**Till:** `permissionsMask: bigint` (TS bigint, unlimited precision)

### Implementering

**Entity:**

```typescript
// backend/src/platform/entities/studio-member.entity.ts
enum PermissionBitMask {
  ManageMembers = 1n << 0n,      // 1n (bigint literal)
  ManageGames = 1n << 1n,        // 2n
  // ...
}

// TypeORM Transformer: string (Postgres) ↔ bigint (TypeScript)
const bigintTransformer: ValueTransformer = {
  to: (value: bigint | null) => value?.toString() ?? "0",      // to DB
  from: (value: string | null) => value ? BigInt(value) : 0n,  // from DB
};

@Column({ type: "bigint", default: "0", transformer: bigintTransformer })
permissionsMask: bigint;
```

**Service DTOs:**

```typescript
export interface CreateMemberDto {
  permissionsMask?: bigint; // Changed from number
}

export interface UpdateMemberDto {
  permissionsMask?: bigint; // Changed from number
}
```

**Helper Methods:**

```typescript
maskToFlags(mask: bigint): Record<string, boolean> {
  return {
    ManageMembers: !!(mask & PermissionBitMask.ManageMembers),
    // ... (bitwise operators work with bigint)
  };
}

flagsToMask(flags: Record<string, boolean>): bigint {
  let mask = 0n;  // Start with bigint
  if (flags.ManageMembers) mask |= PermissionBitMask.ManageMembers;
  // ...
  return mask;
}

hasPermission(member: StudioMember, permission: bigint): boolean {
  return (member.permissionsMask & permission) !== 0n;  // 0n for bigint
}
```

### Fördelar

- ✅ Ingen precision-loss
- ✅ Framtidssäker (kan expandera till flera bits)
- ✅ TypeORM transformer hanterar Postgres ↔ TS konvertering
- ✅ Enkelt att arbeta med i kod (bigint är native i TS 3.2+)

---

## ✅ ISSUE 2: Route Guards - Veriferad för NO LOOPS

### Redirect Map

```
PUBLIC (Unauthenticated allowed):
┌─ /login ────────────────────────────┐
│ ProtectedUnauthenticated            │
│ if authenticated → redirect /dashboard
└────────────────────────────────────┘

READ-ONLY (Studio session required):
┌─ /dashboard ───────────────────────┐
│ ProtectedStudioAuth                │
│ if Unauthenticated → redirect /login
│ allows: StudioAuthenticated + Studio+MemberActive
└────────────────────────────────────┘

ADMIN (Member session required):
┌─ /members, /games, /settings ──────┐
│ ProtectedMemberAuth                │
│ if Unauthenticated → redirect /login
│ if StudioAuthenticated → redirect /dashboard
│ allows: Studio+MemberActive only
└────────────────────────────────────┘
```

### Loop Prevention Matrix

```
Current Page: /login
  State: Unauthenticated      → Render page ✅
  State: Studio+... →  Redirect /dashboard (→ allows all) ✅ NO LOOP

Current Page: /dashboard
  State: Unauthenticated → Redirect /login (→ unauthenticated) ✅ NO LOOP
  State: StudioAuth... → Render page ✅
  State: Studio+Member... → Render page ✅

Current Page: /members
  State: Unauthenticated → Redirect /login (→ unauthenticated) ✅ NO LOOP
  State: StudioAuth... → Redirect /dashboard (→ allows all) ✅ NO LOOP
  State: Studio+Member... → Render page ✅
```

✅ **Conclusion: Inga redirect-loops möjliga**

---

## ✅ PUNKT 4: AppLayout + Header Implementation

### Nya Filer

#### 1. `frontend/src/components/AppLayout.tsx`

Tre komponenter:

- **Header** - state-styrd navigation
- **Main content area** - children renderas här
- **Footer** - enhetlig footer

**Header Features:**

- **Unauthenticated:** Login + Sign Up buttons
- **StudioAuthenticated:** Studio-info + "Select Member" + Logout
- **Studio+MemberActive:**
  - Studio + Member info
  - Owner badge (if applicable)
  - Admin links (dinamiska baserat på permissions)
  - Two logout buttons:
    - "Back to Studio" (logoutMember)
    - "Logout" (logoutStudio)

**AdminLinks Component:**

```typescript
// Dynamically shown buttons based on permissions:
- Members (if canManageMembers)
- Games (if hasManageGames)
- Settings (if hasManageSettings)
- Dashboard (always)
```

#### 2. `frontend/src/components/AppLayout.css`

- Flexbox layout (header top, content middle, footer bottom)
- Responsive design (mobile-friendly)
- Button styling (primary, secondary, danger, outline)
- Info badges (studio, member, owner)

### App.tsx Integration

```typescript
<AppRoutes>
  - /login, /signup, /create-studio → NO layout

  <AppLayout>
    <AppRoutesWithLayout>
      - /dashboard, /studios → ProtectedStudioAuth
      - /home, /games, /members → ProtectedMemberAuth
  </AppLayout>
</AppRoutes>
```

**Logik:**

- Login pages renderas utan layout (mer minimal)
- Authenticated pages har full layout med header/footer
- Header är state-aware (visar olika buttons per state)

---

## Tydlig Permission-styrning

**Header visar ENDAST relevanta knappar:**

```
State: Unauthenticated
└─ Header: "Login" + "Sign Up"

State: StudioAuthenticated
└─ Header: "Studio: [Name]" + "Select Member" + "Logout"

State: Studio+MemberActive
├─ Header: "Studio: [Name]"
├─ "Member: [email]" + [Owner badge if applicable]
├─ Admin Links:
│  ├─ "Members" ← only if canManageMembers
│  ├─ "Games" ← only if hasManageGames
│  └─ "Settings" ← only if hasManageSettings
└─ "Back to Studio" + "Logout"
```

**Inga irrelevanta knappar visas.**

---

## Testing Checklist

- [ ] Login page shows without layout
- [ ] After login, /dashboard shows header + layout
- [ ] Header shows studio + member info
- [ ] "Select Member" button redirects to /studios
- [ ] "Back to Studio" button clears member session, stays on /dashboard
- [ ] "Logout" button clears all, redirects to /login
- [ ] Admin links only show if member has permissions
- [ ] Owner badge shows only for owner members
- [ ] Responsive design works on mobile (buttons stack)

---

## Files Created/Modified

### Created

- `frontend/src/components/AppLayout.tsx` (200 lines)
- `frontend/src/components/AppLayout.css` (250 lines)

### Modified

- `backend/src/platform/entities/studio-member.entity.ts` (bigint + transformer)
- `backend/src/platform/studio-member.service.ts` (bigint DTOs + helpers)
- `frontend/src/lib/RouteGuards.tsx` (clarified, no changes to logic)
- `frontend/src/App.tsx` (integrated AppLayout)

---

## Next: Punkt 5 (UI Pages - Login, Dashboard, Members)

Ready to implement:

1. **Login Page** - form + session storage
2. **Dashboard** - studio info + member selector
3. **Members Page** - list + CRUD + permissions
4. **Settings Page** (if needed)
