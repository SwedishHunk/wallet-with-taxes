# Steg A - Members CRUD Implementation

## Overview

Members MVP är nu implementerad med:

- Endpoints för att lista och skapa medlemmar
- Frontend-sida för att hantera medlemmar
- Permission-baserad åtkomst (Owner eller ManageMembers)
- Integration med existing auth/session system

## Backend Endpoints (Created)

### 1. GET `/studios/:studioId/members`

**Purpose**: List all members in a studio

**Auth**: JwtAuthGuard (requires valid token)

**Authorization**: Must be a member of the studio (any permission level)

**Response**:

```json
[
  {
    "id": "uuid",
    "userId": "uuid",
    "email": "member@example.com",
    "isOwner": true,
    "role": "owner",
    "permissions": [
      "ManageMembers",
      "ManageGames",
      "ManageSettings",
      "MintNFT",
      "MakeTransactions"
    ],
    "gameAccessIds": [],
    "createdAt": "2026-01-27T10:20:00Z"
  },
  {
    "id": "uuid",
    "userId": "uuid",
    "email": "admin@example.com",
    "isOwner": false,
    "role": "admin",
    "permissions": ["ManageMembers"],
    "gameAccessIds": [],
    "createdAt": "2026-01-27T10:21:00Z"
  }
]
```

### 2. POST `/studios/:studioId/members`

**Purpose**: Create a new member (invite user to studio)

**Auth**: JwtAuthGuard (requires valid token)

**Authorization**: Actor must be Owner OR have ManageMembers permission

**Request Body**:

```json
{
  "email": "newmember@example.com",
  "password": "optionalPassword123", // Optional - generated if not provided
  "role": "MEMBER", // Optional - defaults to MEMBER
  "permissions": [
    // Optional - defaults to read-only
    "ManageMembers",
    "ManageGames"
  ]
}
```

**Response**:

```json
{
  "id": "uuid",
  "userId": "uuid",
  "email": "newmember@example.com",
  "isOwner": false,
  "role": "admin",
  "permissions": ["ManageMembers", "ManageGames"],
  "gameAccessIds": [],
  "createdAt": "2026-01-27T10:22:00Z"
}
```

**Behavior**:

- If user with email doesn't exist: create User + Membership
- If user exists but not in studio: create Membership only
- If user already a member: return 400 error
- If password not provided: generate random temporary password
- New user gets email + credentials to login

## Backend Implementation

### New Files Created

1. `backend/src/platform/studios.service.ts` - Service layer for members CRUD
2. `backend/src/platform/studios.controller.ts` - Route handlers for members endpoints

### Updated Files

1. `backend/src/platform/platform.module.ts` - Added StudiosService + StudiosController to module
2. `backend/src/platform/studio-member.service.ts` - Added `hasPermission()` helper method

### Key Logic

- Permission conversion: string[] ↔ bigint bitmask
- Authorization: `assertCanManageMembers()` enforces Owner OR ManageMembers
- User creation: Auto-generates wallet + temporary password if needed
- Response normalization: Converts bitmask back to readable string[] for client

## Frontend Implementation

### New Files Created

1. `frontend/src/pages/Members.tsx` - Full Members management page
2. `frontend/src/style/Members.css` - Styling for Members page

### Features

- **List Members**: Display all studio members with roles + permissions
- **Create Member Form**: Add new member with:
  - Email (required)
  - Optional password (generates temp password if empty)
  - Permission checkboxes (ManageMembers, ManageGames, ManageSettings, MintNFT, MakeTransactions)
- **Permission Display**: Shows badges for each member's permissions
- **Owner Badge**: Highlights owner members differently
- **Access Control**: Only shows create form if user has ManageMembers or isOwner

### Updated Files

1. `frontend/src/App.tsx` - Imports Members page, uses real component instead of stub
2. `frontend/src/lib/useAuth.ts` - Added main `useAuth()` hook for UI convenience
3. `frontend/src/lib/AuthContext.tsx` - Fixed type naming conflicts (AuthContext → AuthContextData)

## How to Test (Complete Flow)

### Prerequisites

- Backend running on http://localhost:3000
- Frontend running on http://localhost:5173
- Postgres database initialized

### Test Scenario 1: Create Member and Login

**Step 1: Signup as Owner**

1. Navigate to http://localhost:5173/create-studio
2. Fill form:
   - Studio Name: "Test Studio"
   - Email: owner@example.com
   - Password: password123
   - Confirm Password: password123
3. Submit → auto-login → dashboard

**Step 2: Navigate to Members Page**

1. Click "Hantera medlemmar" button on dashboard
2. Should see Members page with just yourself as owner

**Step 3: Create New Member**

1. Click "+ Lägg till medlem"
2. Fill form:
   - Email: member1@example.com
   - Password: (leave empty - will generate)
   - Check: ManageMembers, ManageGames
3. Click "Skapa medlem"
4. Should see success + new member appears in list with those permissions

**Step 4: Login as New Member**

1. Logout (top-right menu)
2. Click "Logga ut (studio)" or navigate to /login
3. Login with:
   - Email: member1@example.com
   - Password: (check console logs or generated temp password if you saved it)
4. Should be redirected to member-login (select studio)
5. Click "Aktivera" for your studio
6. Should see dashboard with correct permissions displayed
7. "Hantera medlemmar" button should be visible (has ManageMembers)

**Step 5: Verify Member Permissions**

1. Member logs in
2. Can navigate to /members and see all members
3. Can create more members (has ManageMembers)
4. Dashboard shows "Hantera medlemmar" button

### Test Scenario 2: Member Without ManageMembers

**Step 1: Create Read-Only Member**

1. As Owner, on Members page
2. Create new member:
   - Email: viewer@example.com
   - No permissions checked
3. Submit

**Step 2: Login as Read-Only Member**

1. Logout, login with viewer@example.com
2. Member-select view (Aktivera studio)
3. Click "Aktivera"
4. On dashboard: "Hantera medlemmar" button NOT visible
5. Try direct /members navigation → should see error "You don't have permission to manage members"

### Test Scenario 3: Multiple Studios

**Step 1: Create Second Studio**

1. Owner logout
2. Signup new account with different email
3. Creates new studio + auto-login

**Step 2: Cross-Studio Isolation**

1. Each studio is separate
2. Members in studio A can't see/manage studio B
3. Permissions are per-studio

## Routes/Endpoints Summary

**Backend REST API**:

```
GET  /studios/:studioId/members        → List all members
POST /studios/:studioId/members        → Create new member
```

**Frontend Pages**:

```
/members        → Manage members (ProtectedMemberAuth)
/dashboard      → Studio overview (ProtectedStudioAuth)
/login          → Auth entry point
/create-studio  → One-step signup
```

## Key Files Changed

```
backend/
├── src/platform/
│   ├── studios.service.ts           (NEW)
│   ├── studios.controller.ts         (NEW)
│   ├── platform.module.ts            (UPDATED)
│   └── studio-member.service.ts      (UPDATED: added hasPermission)

frontend/
├── src/pages/
│   ├── Members.tsx                   (NEW)
├── src/style/
│   ├── Members.css                   (NEW)
├── src/lib/
│   ├── useAuth.ts                    (UPDATED: added main useAuth hook)
│   └── AuthContext.tsx               (UPDATED: fixed type names)
└── src/App.tsx                       (UPDATED: imports real Members page)
```

## Next Steps (Steg B)

Once you verify this works:

**Login Flow Improvements**:

1. When studio-session exists but no member-session:
   - Show "Select studio/membership" UI if user belongs to multiple studios
   - Auto-select if only one studio
   - Activate member-session via GET `/users/member-session/:studioId`

2. Label clarity:
   - Change "Back to Studio" → "Lämna medlem"
   - Dashboard shows badge "Studio only (read-only)" when memberSession is missing

3. Separate email+password login per user:
   - Each member has own email + password
   - Not "auto-login same member without choice"

## API Documentation

### Permission Bits (Backend)

```typescript
ManageMembers: 1n(0b00001);
ManageGames: 2n(0b00010);
ManageSettings: 4n(0b00100);
MintNFT: 8n(0b01000);
MakeTransactions: 16n(0b10000);
```

### Member Roles

```typescript
enum StudioRole {
  OWNER = "owner",
  ADMIN = "admin",
  MEMBER = "member",
}
```

### Error Responses

```json
{
  "statusCode": 400,
  "message": "User is already a member of this studio.",
  "code": "BAD_REQUEST"
}
```

```json
{
  "statusCode": 403,
  "message": "Insufficient permissions to manage members.",
  "code": "FORBIDDEN"
}
```

## Testing Checklist

- [ ] Backend builds without errors
- [ ] Frontend builds without errors
- [ ] Signup creates studio + owner membership + auto-login
- [ ] Owner can navigate to /members page
- [ ] Owner can create new member with permissions
- [ ] New member is added to database + returned in API
- [ ] Login as new member → shows correct permissions on dashboard
- [ ] Member without ManageMembers can't see create form
- [ ] Direct /members access with insufficient perms shows error
- [ ] Multiple studios are isolated per user
- [ ] Temporary password login works for new members
