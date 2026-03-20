# Implementation Checklist - Punkt 1-3 ✅

## Backend (Punkt 1-2)

### Entities & Types

- [x] `studio-member.entity.ts` - `isOwner`, `permissionsMask` (safe BIGINT), `gameAccessIds`
- [x] `PermissionBitMask` enum i entity
- [x] `ValueTransformer` för säker string→number konvertering
- [x] `studio.entity.ts` - no changes needed
- [x] `user.entity.ts` - no changes needed

### Service Layer

- [x] `studio-member.service.ts` - 6 methods + 6 helpers
  - [x] `assertIsOwner()` - for promoteToOwner only
  - [x] `assertCanManageMembers()` - Owner OR ManageMembers permission
  - [x] `assertSameStudio()` - boundary check
  - [x] `assertTargetNotOwner()` - protect Owners
  - [x] `assertNotLastOwner()` - ensure min 1 Owner
  - [x] `createMember()` - use `assertCanManageMembers()`
  - [x] `updateMember()` - use `assertCanManageMembers()` + `assertTargetNotOwner()`
  - [x] `deleteMember()` - use `assertCanManageMembers()` + `assertTargetNotOwner()`
  - [x] `promoteToOwner()` - use `assertIsOwner()` (STRICT)
  - [x] `createBootstrapOwner()` - for signup/login
  - [x] `hasPermission()` - bitmask check
  - [x] `hasGameAccess()` - array check
  - [x] `maskToFlags()` - bitmask → object
  - [x] `flagsToMask()` - object → bitmask

### Module Integration

- [x] `platform.module.ts` - register `StudioMemberService`
- [x] `users.service.ts` - inject + use `createBootstrapOwner()`
- [x] `users.module.ts` - import `PlatformModule`

### Invariants Enforced

- [x] #1: Owner kan ikke modifieras
- [x] #2: Min 1 Owner per Studio
- [x] #3: Owner OR ManageMembers kan administrera icke-Owners
- [x] #4: ONLY Owner kan promovera
- [x] #5: Samma studio boundary
- [x] #6: Bootstrap auto-activation

---

## Frontend (Punkt 3)

### Types

- [x] `frontend/src/types/auth.ts` - `AuthState`, `StudioSession`, `MemberSession`, `AuthContext`
- [x] `frontend/src/types/studio.ts` - `Studio`, `StudioWithMembers`
- [x] `frontend/src/types/member.ts` - `Member`, `PermissionFlags`, `MemberRole`, helpers

### Session Management

- [x] `frontend/src/lib/AuthContext.tsx` - `AuthProvider` + `useAuthState()`
  - [x] LocalStorage persistence (`lia_studio_session`, `lia_member_session`)
  - [x] Auto-hydration on mount
  - [x] Auto-calculation of `AuthState`
  - [x] `setStudioSession()` - save + persist
  - [x] `setMemberSession()` - save + persist
  - [x] `logoutStudio()` - clear all, redirect /login
  - [x] `logoutMember()` - clear member only, redirect /dashboard

### Route Protection

- [x] `frontend/src/lib/RouteGuards.tsx` - three guards
  - [x] `ProtectedUnauthenticated` - only when no session
  - [x] `ProtectedStudioAuth` - when studio-session exists
  - [x] `ProtectedMemberAuth` - when both sessions exist
  - [x] `WithAuth()` - HOC variant (optional)

### Custom Hooks

- [x] `frontend/src/lib/useAuth.ts` - 9 hooks
  - [x] `useCanManageMembers()` - Owner OR ManageMembers
  - [x] `useCanPromoteToOwner()` - Owner only
  - [x] `useHasPermission(key)` - specific permission check
  - [x] `useHasGameAccess(gameId)` - specific game access
  - [x] `useCurrentMember()` - get member session
  - [x] `useCurrentStudio()` - get studio session
  - [x] `useLoginMember()` - save member session
  - [x] `useLoginStudio()` - save studio session
  - [x] `useLogout()` - access logout functions

### App Integration

- [x] `frontend/src/App.tsx` - wrap with `AuthProvider`
  - [x] Apply guards to all routes
  - [x] `/` → `ProtectedUnauthenticated`
  - [x] `/login`, `/signup`, `/create-studio` → `ProtectedUnauthenticated`
  - [x] `/dashboard`, `/studios` → `ProtectedStudioAuth`
  - [x] `/home`, `/game/:id`, `/personal-accounts` → `ProtectedMemberAuth`

### Three Auth States Flow

- [x] **Unauthenticated** - no sessions
  - [x] Access: login, signup, create-studio
  - [x] Redirect from: dashboard (→ login)
- [x] **StudioAuthenticated** - studio-session only
  - [x] Access: dashboard (read-only), studio-selector
  - [x] CTA: select/login as member
  - [x] Redirect to: member-login flow
- [x] **Studio+MemberActive** - both sessions
  - [x] Access: all admin pages (members, games, settings)
  - [x] Full functionality based on permissions
  - [x] Redirect from: login (→ /home)

---

## Documentation

- [x] `IMPLEMENTATION_GUIDE.md` - complete reference
- [x] `OWNER_RULES_QUICK_REF.md` - quick lookup + policy matrix
- [x] `VERIFICATION_TWO_QUESTIONS.md` - BIGINT + ManageMembers fixes
- [x] `frontend/POINT_3_SESSION_STATE.md` - session management guide

---

## Next: Frontend UI (Punkt 4)

Ready to implement:

### 1. Login Page

- [ ] Form: email + password
- [ ] On success: store sessions via `useLoginStudio()` + `useLoginMember()`
- [ ] Handle bootstrap case (auto-promote first owner)
- [ ] Handle multi-member case (show member selector)
- [ ] Handle auto-login (if already saved)

### 2. Dashboard (Studio Read-Only)

- [ ] Show studio info
- [ ] If `StudioAuthenticated` - show CTA "Select Member to Continue"
- [ ] If `Studio+MemberActive` - show member info + logout button
- [ ] Member selector component (list available members)
- [ ] "Logout Studio" button (global)

### 3. Members Page

- [ ] List all members with permission badges
- [ ] `useCanManageMembers()` - show edit/delete buttons
- [ ] `useCanPromoteToOwner()` - show promote button
- [ ] Form: add new member, set permissions, set game-access
- [ ] Handle Owner-immutability (disable buttons for Owners)
- [ ] Confirm dialogs for dangerous ops

### 4. Global Logout

- [ ] "Logout Studio" - `logoutStudio()` → /login
- [ ] "Back to Studio" / "Logout Member" - `logoutMember()` → /dashboard

---

## Testing Checklist

### Backend Tests

- [ ] Create member with ManageMembers permission
- [ ] Verify ManageMembers can create/edit other members
- [ ] Verify ManageMembers CANNOT promote to Owner (403)
- [ ] Verify Owner cannot be modified (403)
- [ ] Verify Studio cannot go to 0 Owners (400)
- [ ] Test BIGINT transformer (string→number)

### Frontend Tests

- [ ] Login → both sessions saved → state = `Studio+MemberActive`
- [ ] Refresh page → sessions hydrated from localStorage
- [ ] Navigate to protected route without session → redirect /login
- [ ] Navigate to member-only route without member → redirect /dashboard
- [ ] `useCanManageMembers()` = true for Owner
- [ ] `useCanManageMembers()` = true for ManageMembers permission
- [ ] `useCanManageMembers()` = false for regular member
- [ ] `useCanPromoteToOwner()` = true for Owner only
- [ ] `logoutStudio()` clears both sessions
- [ ] `logoutMember()` keeps studio session

---

## Completed ✅

```
Punkt 1: Datamodell
  ├─ Frontend types (auth, studio, member) ✅
  └─ Backend entities (isOwner, permissionsMask, gameAccessIds) ✅

Punkt 2: Owner-Immutability
  ├─ Service enforcement (6 methods + 6 helpers) ✅
  ├─ BIGINT transformer (safe string→number) ✅
  ├─ ManageMembers policy (Owner OR ManageMembers) ✅
  └─ Integration (users.service, modules) ✅

Punkt 3: Session/State
  ├─ AuthContext + useAuthState() ✅
  ├─ Route guards (three states) ✅
  ├─ Custom hooks (9 utilities) ✅
  ├─ App.tsx integration ✅
  └─ LocalStorage persistence ✅

Punkt 4-6: UI Components (READY)
```

---

**Status:** Ready to start Punkt 4 (UI components)
**Last Updated:** 2026-01-26
