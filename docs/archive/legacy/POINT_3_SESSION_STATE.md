# Session & State Management - Frontend (Punkt 3)

## Arkitektur

### LocalStorage Persistence

```
localStorage keys:
├── lia_studio_session    → StudioSession (studio-level auth)
└── lia_member_session    → MemberSession (member-level auth)
```

### AuthContext

- Global React Context för auth state
- Auto-hydrates från localStorage på mount
- Beräknar `AuthState` baserat på vilka sessioner som finns

### AuthState = tre möjliga states

```typescript
type AuthState =
  | "Unauthenticated" // Ingen studio-session
  | "StudioAuthenticated" // Studio-session, men ingen member
  | "Studio+MemberActive"; // Båda aktiva
```

---

## Filer Skapade

### 1. `frontend/src/lib/AuthContext.tsx`

**AuthProvider + useAuthState hook**

Features:

- Persist studio + member sessions to localStorage
- Auto-hydrate on mount
- Calculate auth state from sessions
- `logoutStudio()` - clears all, redirects to /login
- `logoutMember()` - clears only member, redirects to /dashboard

```typescript
// Wrap app with AuthProvider
<AuthProvider>
  <App />
</AuthProvider>

// Use in components
const { authContext, setMemberSession, logoutStudio } = useAuthState();

authContext.state          // "Unauthenticated" | "StudioAuthenticated" | "Studio+MemberActive"
authContext.studioSession  // StudioSession | null
authContext.memberSession  // MemberSession | null
```

### 2. `frontend/src/lib/RouteGuards.tsx`

**Tre route protection komponenter**

```typescript
// Only when NOT logged in (login, signup, create-studio)
<ProtectedUnauthenticated>
  <Login />
</ProtectedUnauthenticated>

// When studio-session exists (dashboard, studios selector)
<ProtectedStudioAuth>
  <Dashboard />
</ProtectedStudioAuth>

// When BOTH studio + member sessions exist (members, games, settings)
<ProtectedMemberAuth>
  <GameControl />
</ProtectedMemberAuth>
```

**HOC variant (optional):**

```typescript
const ProtectedPage = WithAuth(MyComponent, "Studio+MemberActive");
<Route path="/members" element={<ProtectedPage />} />
```

### 3. `frontend/src/lib/useAuth.ts`

**Custom hooks för common operations**

```typescript
// Check if can manage members (Owner OR ManageMembers permission)
const canManage = useCanManageMembers();

// Check if can promote to Owner (Owner only)
const canPromote = useCanPromoteToOwner();

// Check specific permission
const canMintNFT = useHasPermission("MintNFT");

// Check game access
const hasAccess = useHasGameAccess(gameId);

// Get current member/studio info
const member = useCurrentMember(); // MemberSession | null
const studio = useCurrentStudio(); // StudioSession | null

// Save sessions after login
const { loginMember } = useLoginMember();
const { loginStudio } = useLoginStudio();

// Logout
const { logoutStudio, logoutMember } = useLogout();
```

---

## Integration i App.tsx

Alla routes är nu wrapped med lämplig guard:

```
/                         → ProtectedUnauthenticated (Login)
/signup                   → ProtectedUnauthenticated (Signup)
/create-studio            → ProtectedUnauthenticated (Create)

/dashboard                → ProtectedStudioAuth (read-only, show member-login CTA)
/studios                  → ProtectedStudioAuth (studio selector)

/home                     → ProtectedMemberAuth (full access)
/create-first-account     → ProtectedMemberAuth (full access)
/account-login            → ProtectedMemberAuth (full access)
/personal-accounts        → ProtectedMemberAuth (full access)
/game/:gameId             → ProtectedMemberAuth (full access)
```

---

## Flow: Login → Member Activation

### Scenario: Användare loggar in

1. **Skicka credentials till backend**

   ```
   POST /auth/login
   { email, password, studioId? }
   ```

2. **Backend returnerar**

   ```json
   {
     "studioSession": {
       "studioId": "...",
       "studioName": "...",
       "authenticatedAt": "..."
     },
     "memberSession": {
       "memberId": "...",
       "userId": "...",
       "studioId": "...",
       "email": "...",
       "isOwner": false,
       "permissions": { ... },
       "gameAccessIds": [...],
       "authenticatedAt": "..."
     }
   }
   ```

3. **Frontend lagrar sessions**

   ```typescript
   const { loginStudio } = useLoginStudio();
   const { loginMember } = useLoginMember();

   loginStudio(studioSession);
   loginMember(memberSession);

   // Omdirigering sker automatiskt baserat på ny state
   ```

---

## Flow: Bootstrap (första studio-skapande)

1. **Användare skapar studio**
   - Backend: `UsersService.signup()` → `createBootstrapOwner()`
   - Owner-medlem skapas med `isOwner=true`, alla permissions

2. **Frontend mottager login-response med auto-populated sessions**
   - `studioSession` → owner's studio
   - `memberSession` → owner-medlem auto-active

3. **State blir omedelbar "Studio+MemberActive"**
   - Dirigering till /home (eller där vi vill)
   - Ingen CTA för member login (redan aktiv)

---

## Flow: Logout (Studio)

Button: "Logout Studio" (global)

```typescript
const { logoutStudio } = useLogout();

// Click handler
const handleLogoutStudio = () => {
  logoutStudio();
  // Clears: studioSession, memberSession
  // Redirects: /login
};
```

---

## Flow: Logout (Member Only)

Button: "Back to Studio Dashboard" (nur om StudioAuthenticated)

```typescript
const { logoutMember } = useLogout();

// Click handler
const handleLogoutMember = () => {
  logoutMember();
  // Clears: memberSession only
  // Redirects: /dashboard (studio read-only mode)
};
```

---

## Säkerhet & Best Practices

1. **Token-lagring**: Befintlig JWT token fortsätter att sparas i localStorage
   - Vi kan kombinera med bearer tokens senare

2. **Session-persistance**: Sessions lagras som JSON
   - Vi **antar** att localStorage är tillgängligt
   - För XSS-protection: övervåg httpOnly cookies i framtiden

3. **Permission-checks**: Gör både frontend (UI-döljning) och backend
   - Frontend: `useCanManageMembers()` → visa/dölj knappar
   - Backend: `StudioMemberService` → enforce regler

4. **isLoading state**: AuthProvider sätter `isLoading=true` tills localStorage är hydratiserad
   - Använd detta för att inte rendera UI innan auth-state är känd

---

## Nästa Steg (Punkt 5-6)

✅ Punkt 3: **Session/state-hantering** DONE
⏳ Punkt 4: **UI-komponenter** (Login, Dashboard, Members)
⏳ Punkt 5: **Logout actions** (redan setup i AuthContext)

---

## Utveckling: Test LocalStorage Persistence

Öppen DevTools > Application > LocalStorage:

```
lia_studio_session: {
  "studioId": "abc...",
  "studioName": "My Studio",
  "authenticatedAt": "2026-01-26T10:00:00Z"
}

lia_member_session: {
  "memberId": "def...",
  "userId": "ghi...",
  "studioId": "abc...",
  "email": "user@example.com",
  "isOwner": true,
  "permissions": { ... },
  "gameAccessIds": [...],
  "authenticatedAt": "2026-01-26T10:00:00Z"
}
```

Logga in → check localStorage → stäng page → öppna igen → session kvar ✓
