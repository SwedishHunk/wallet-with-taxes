# 🚀 STEG A - QUICK REFERENCE

## 5-Minute Recap

**What**: Members CRUD system - create users as members of studios

**Files Changed**: 9 files (3 new, 5 updated)

**Endpoints**: 2 (GET /studios/{id}/members, POST /studios/{id}/members)

**Build Status**: ✅ Both pass

**Servers**: ✅ Both running

---

## Test Right Now

```
1. http://localhost:5173/create-studio
   Studio Name: Test, Email: owner@ex.com, Pass: 123456

2. Click "Hantera medlemmar" button

3. Click "+ Lägg till medlem"
   Email: user1@ex.com, Check: ManageMembers

4. Create member → appears in list

5. Logout → Login as user1@ex.com, Password: auto-generated

6. Go to /members → should work (has ManageMembers)

7. Create read-only member (no permissions)

8. Logout → Login as read-only

9. Go to /members → ERROR (no ManageMembers)

✅ WORKING!
```

---

## Files You Need to Know

### Backend

- `studios.service.ts` - Business logic
- `studios.controller.ts` - HTTP routes
- `platform.module.ts` - Registration

### Frontend

- `Members.tsx` - UI page
- `Members.css` - Styling
- `useAuth.ts` - Permission checks

---

## Key Features

| Feature               | Status | Notes                         |
| --------------------- | ------ | ----------------------------- |
| List members          | ✅     | GET /studios/{id}/members     |
| Create member         | ✅     | POST /studios/{id}/members    |
| New user creation     | ✅     | Auto-creates if doesn't exist |
| Permission checkboxes | ✅     | 5 permission types            |
| Temp password         | ✅     | Generated if not provided     |
| Frontend form         | ✅     | Validation + error handling   |
| Permission display    | ✅     | Badges in list                |
| Access control        | ✅     | Only Manager/Owner see form   |
| Multi-studio          | ✅     | Completely isolated           |

---

## Permission Levels

**Owner**: Everything (immutable)

**ManageMembers**: Can create/list members + manage them

**ManageGames**: Can create/manage games

**ManageSettings**: Can change studio settings

**MintNFT**: Can mint NFTs

**MakeTransactions**: Can send transactions

---

## Errors You Might See

| Error                             | Cause                  | Fix                              |
| --------------------------------- | ---------------------- | -------------------------------- |
| "Permission denied" on /members   | No ManageMembers       | Must be Owner or have permission |
| 404 on POST /studios/{id}/members | Route not found        | Restart backend                  |
| User already member               | Email exists in studio | Use different email              |
| TypeScript errors on build        | Type mismatches        | Run `npm run build`              |
| Backend won't start               | Port 3000 in use       | Kill other process or restart    |
| Frontend build fails              | Module not found       | Run `npm install`                |

---

## Architecture in One Diagram

```
User (email + password)
    ↓
Studio (tenant)
    ↓
StudioMember (role + permissions)
    ├─ isOwner: boolean
    ├─ role: OWNER | ADMIN | MEMBER
    ├─ permissionsMask: bigint (1|2|4|8|16)
    └─ gameAccessIds: UUID[]

Frontend checks: member.permissions.includes("ManageMembers")
Backend checks: (member.permissionsMask & 1n) !== 0n
```

---

## Next After Steg A Works

**Steg B**: Login Flow

- Multi-studio selection
- Member switching
- Better labels

**Steg C**: Member Editing

- Update permissions
- Delete members
- Change roles

**Steg D**: Email Integration

- Send invite links
- Password reset
- Activity logs

---

## Commands

**Build**:

```bash
cd backend && npm run build      # TypeScript check
cd frontend && npm run build     # TypeScript check
```

**Run**:

```bash
cd backend && npm run start:dev  # localhost:3000
cd frontend && npm run dev       # localhost:5173
```

**Test**:

```bash
# Manual browser test - see STEG_A_TESTING_GUIDE.md
# API test via curl - see endpoints in docs
```

---

## Database (No Migration Needed)

Existing `studio_member` table used:

- `id`, `studio_id`, `user_id`, `is_owner`, `role`, `permissions_mask`, `game_access_ids`, `created_at`

Existing `user` table used:

- `id`, `email`, `password_hash`, `encrypted_private_key`, `wallet_address`

---

## Permissions Bitmask Reference

```
ManageMembers:     0b00001 = 1
ManageGames:       0b00010 = 2
ManageSettings:    0b00100 = 4
MintNFT:           0b01000 = 8
MakeTransactions:  0b10000 = 16
```

Example: ManageMembers + ManageGames = 1 | 2 = **3**

---

## API Contracts (Curl Examples)

**Create member**:

```bash
curl -X POST http://localhost:3000/studios/studio-uuid/members \
  -H "Authorization: Bearer token" \
  -H "Content-Type: application/json" \
  -d '{"email":"new@ex.com","permissions":["ManageMembers"]}'
```

**List members**:

```bash
curl http://localhost:3000/studios/studio-uuid/members \
  -H "Authorization: Bearer token"
```

---

## Test Checklist (Copy-Paste)

- [ ] Backend builds: `npm run build` in backend/
- [ ] Frontend builds: `npm run build` in frontend/
- [ ] Backend running on :3000
- [ ] Frontend running on :5173
- [ ] Signup creates account + auto-login
- [ ] /members page accessible
- [ ] Can create new member via form
- [ ] New member appears in list
- [ ] Can login as new member
- [ ] Permissions display correct
- [ ] Read-only member can't create
- [ ] Multiple studios isolated

---

## Support

**If stuck**:

1. Check console (browser) for errors
2. Check backend logs (terminal)
3. Verify JWT token in header
4. Check email format validation
5. Verify studio ID in URL
6. Ensure user has ManageMembers or isOwner

**Documentation**:

- `STEG_A_TESTING_GUIDE.md` - How to test
- `MEMBERS_MVP_IMPLEMENTATION.md` - Technical details
- `STEG_A_AVSLUTAD.md` - Swedish overview

---

## TL;DR

✅ Done: Members CRUD
✅ Done: Frontend form
✅ Done: Permission model
✅ Done: Multi-studio isolation
⏳ Next: Steg B (login flow fixes)

**Status**: Ready to test now!
