# Steg A - Testing Guide (Quick Start)

## What Was Implemented

✅ **Backend Endpoints**:

- `GET /studios/:studioId/members` - List all members
- `POST /studios/:studioId/members` - Create new member (invite)

✅ **Frontend Pages**:

- Members page at `/members` with list + create form
- Permission-based access control
- Form to add members with email + optional password + permission checkboxes

✅ **Integration**:

- Each member is a separate User with own email + password
- Members belong to studios (separate tenant)
- Permissions shown as readable list on both pages

## Test the Full Flow (5 minutes)

### Step 1: Create Studio (Owner)

```
URL: http://localhost:5173/create-studio
- Studio Name: "Test Studio"
- Email: owner@example.com
- Password: password123
- Confirm: password123
→ Creates account + auto-logs in
```

### Step 2: View Members

```
On dashboard, click "Hantera medlemmar"
→ See Members page with yourself as owner
```

### Step 3: Create New Member

```
Click "+ Lägg till medlem"
Form:
- Email: member1@example.com
- Password: (leave empty - generates temporary)
- Check: "ManageMembers" checkbox
- Click "Skapa medlem"

Result: New member appears in list
```

### Step 4: Login as New Member

```
Logout (top-right)
Login page: member1@example.com + (temp password from logs or your input)
→ Member login form
→ Select your studio and click "Aktivera"
→ Dashboard shows correct permissions
→ "Hantera medlemmar" button visible (because has ManageMembers)
```

### Step 5: Create Another Member (Read-Only)

```
As member1 (has ManageMembers):
- Go to /members
- Click "+ Lägg till medlem"
- Email: viewer@example.com
- NO checkboxes (read-only)
- Create

Then logout → login as viewer@example.com
- View members page → ERROR: "You don't have permission"
- That's correct! Read-only members can't manage
```

## Key Behaviors to Verify

| Action                 | Expected                                   | File                                     |
| ---------------------- | ------------------------------------------ | ---------------------------------------- |
| Create studio          | Auto-login to dashboard                    | CreateStudio.tsx                         |
| Click Members button   | Navigate to /members page                  | AppLayout.tsx                            |
| Create member via form | Member created in DB + email logged        | Members.tsx → POST /studios/{id}/members |
| Login as new member    | Shows correct permissions                  | Login.tsx → GET /users/member-session    |
| Member without perm    | Can't see create form, error if direct nav | Members.tsx permission check             |
| Multiple studios       | Each isolated, can only see own members    | studios.service.ts (actor.studio check)  |

## API Contracts

### Create Member (POST)

```bash
curl -X POST http://localhost:3000/studios/{studioId}/members \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "new@example.com",
    "password": "tempPass123",
    "permissions": ["ManageMembers"]
  }'
```

Response 201:

```json
{
  "id": "uuid",
  "userId": "uuid",
  "email": "new@example.com",
  "isOwner": false,
  "role": "MEMBER",
  "permissions": ["ManageMembers"],
  "gameAccessIds": []
}
```

### List Members (GET)

```bash
curl http://localhost:3000/studios/{studioId}/members \
  -H "Authorization: Bearer {token}"
```

Response 200:

```json
[
  {
    "id": "uuid",
    "userId": "uuid",
    "email": "owner@example.com",
    "isOwner": true,
    "role": "owner",
    "permissions": [
      "ManageMembers",
      "ManageGames",
      "ManageSettings",
      "MintNFT",
      "MakeTransactions"
    ],
    "gameAccessIds": []
  }
]
```

## Backend Status

✅ `npm run build` - No TypeScript errors
✅ `npm run start:dev` - Running on localhost:3000
✅ All modules loaded:

- PlatformModule (with StudiosService + StudiosController)
- StudioMemberService (with helper methods)
- AuthModule, UsersModule, etc.

## Frontend Status

✅ `npm run build` - No TypeScript errors
✅ `npm run dev` - Running on localhost:5173
✅ Hot reload working for Members.tsx
✅ Routes registered in App.tsx

## If You Encounter Issues

### "404 - Member not found" when creating

→ Check that you have ManageMembers or isOwner=true

### "User is already a member of this studio"

→ Member already exists - try different email or create in different studio

### Create button doesn't show on /members

→ You don't have ManageMembers permission
→ Only Owner can manage members
→ Check useCanManageMembers() in header

### "Cannot POST /studios/:studioId/members"

→ Route not registered?
→ Check platform.controller.ts has @Post(":studioId/members")
→ Check platform.module.ts includes StudiosController in controllers array

### Temp password login fails

→ Password might have special chars
→ Check backend logs for generated password
→ Or explicitly provide password in create form

## Database Changes

New rows created when member added:

1. `studio_member` - Entry linking user to studio
2. `user` - New user record (if email not already in system)

```sql
-- View all studio members:
SELECT sm.id, sm.is_owner, sm.permissions_mask, u.email
FROM studio_member sm
JOIN "user" u ON sm.user_id = u.id
WHERE sm.studio_id = ?;
```

## Files to Review

1. **Backend**:
   - `backend/src/platform/studios.service.ts` - Main business logic
   - `backend/src/platform/studios.controller.ts` - HTTP handlers
   - `backend/src/platform/platform.module.ts` - Module registration

2. **Frontend**:
   - `frontend/src/pages/Members.tsx` - UI form + list
   - `frontend/src/lib/useAuth.ts` - Permission checks
   - `frontend/src/App.tsx` - Route definition

## Next: Steg B - Login Flow

After verifying Steg A works:

- Multi-studio member selection (if user has >1 studio)
- Auto-select single studio
- Activate member-session via dedicated endpoint
- "Lämna medlem" button (logout from member view)
- "Studio only (read-only)" badge

---

**Total Implementation Time**: ~2 hours
**Endpoints Created**: 2 (GET + POST)
**Frontend Pages**: 1 (Members)
**New Services**: 1 (StudiosService)
**New Components**: 1 (Members.tsx)
