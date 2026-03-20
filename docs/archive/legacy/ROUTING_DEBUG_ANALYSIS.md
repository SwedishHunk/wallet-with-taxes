# 🔴 ROUTING DEBUG ANALYSIS

## 1. ROUTES.ts - Canonical Definitions

```typescript
export const ROUTES = {
  root: "/",
  login: "/login",
  signup: "/signup",
  createStudio: "/create-studio",
  dashboard: "/dashboard",
  studios: "/studios",
  members: "/members",
  games: "/games",
  settings: "/settings",
};
```

## 2. App.tsx - Registered Routes

```
✅ "/" → Login (public)
✅ "/login" → Login (public)
✅ "/signup" → Signup (protected: ProtectedUnauthenticated)
✅ "/create-studio" → CreateStudio (protected: ProtectedUnauthenticated)
✅ "/dashboard" → Dashboard (protected: ProtectedStudioAuth, in layout)
✅ "/studios" → StudioSelector (protected: ProtectedStudioAuth, in layout)
✅ "/members" → Members (protected: ProtectedMemberAuth, in layout)
✅ "/games" → TODO (protected: ProtectedMemberAuth, in layout)
✅ "/settings" → TODO (protected: ProtectedMemberAuth, in layout)
✅ "/home" → Redirect to /dashboard
✅ "/create-first-account" → CreateFirstPersonalAccount
✅ "/account-login" → PersonalAccountLogin
✅ "/personal-accounts" → PersonalAccounts
✅ "/game/:gameId" → GameControl
✅ "*" → NotFound
```

## 3. MISMATCHES FOUND 🔴

### Dashboard.tsx (Line 29 + 55)

```
❌ navigate("/login")          → Should be ROUTES.login
❌ navigate("/members")        → Should be ROUTES.members
```

### Members.tsx (Line check needed)

```
Need to verify all navigate() calls use ROUTES.*
```

### CreateStudio.tsx (Line 71 + 135)

```
❌ navigate("/dashboard")      → Should be ROUTES.dashboard
❌ navigate("/login")          → Should be ROUTES.login
```

### Login.tsx (Multiple lines)

```
❌ navigate("/dashboard")      → Should be ROUTES.dashboard (lines 29, 65, 98)
❌ navigate("/create-studio")  → Should be ROUTES.createStudio (line 147)
```

### AppLayout.tsx (Line 50)

```
⚠️  to="/"                     → Could use ROUTES.root
```

### RouteGuards.tsx (Multiple redirects)

```
❌ navigate("/login")          → Should be ROUTES.login
❌ navigate("/dashboard")      → Should be ROUTES.dashboard
```

### GameControl.tsx

```
❌ navigate("/")               → Should be ROUTES.root or ROUTES.login
❌ navigate("/studios")        → Should be ROUTES.studios
❌ navigate("/account-login")  → NOT in ROUTES! Needs to be added
❌ navigate("/dashboard")      → Should be ROUTES.dashboard
```

### StudioSelector.tsx

```
❌ navigate("/")               → Should be ROUTES.login or ROUTES.root
❌ navigate("/create-first-account")  → NOT in ROUTES! Needs to be added
❌ navigate("/account-login")  → NOT in ROUTES! Needs to be added
❌ navigate("/create-studio")  → Should be ROUTES.createStudio
```

### PersonalAccounts.tsx

```
❌ navigate("/")               → Should be ROUTES.root
❌ navigate("/home")           → Should be ROUTES.dashboard (after redirect)
❌ navigate("/dashboard")      → Should be ROUTES.dashboard
```

### HomePage.tsx

```
❌ navigate("/create-first-account")  → NOT in ROUTES!
❌ navigate("/")               → Should be ROUTES.root
❌ navigate("/account-login")  → NOT in ROUTES!
❌ navigate("/personal-accounts")  → NOT in ROUTES!
```

## 4. MISSING ROUTES 🔴

These paths exist in code but NOT in ROUTES.ts:

- "/create-first-account"
- "/account-login"
- "/personal-accounts"
- "/game/:gameId" (exists as route param)

## 5. BUTTON NAVIGATION CHECKLIST

### Most Important Buttons:

| Button                | Current                  | Should Be                | File          | Line |
| --------------------- | ------------------------ | ------------------------ | ------------- | ---- |
| "Hantera medlemmar"   | navigate("/members")     | navigate(ROUTES.members) | Dashboard.tsx | 55   |
| "Members" (header)    | to={ROUTES.members}      | ✅ OK                    | AppLayout.tsx | 149  |
| "Select Member"       | navigate(ROUTES.studios) | ✅ OK                    | AppLayout.tsx | 77   |
| "Logga in som medlem" | navigate("/login")       | navigate(ROUTES.login)   | Dashboard.tsx | 29   |
| "Sign Up" (header)    | to={ROUTES.createStudio} | ✅ OK                    | AppLayout.tsx | 61   |

## 6. RECOMMENDED FIXES

### Priority 1 (Dashboard + key pages)

```
Dashboard.tsx:
  Line 29: "/login" → ROUTES.login
  Line 55: "/members" → ROUTES.members

CreateStudio.tsx:
  Line 71: "/dashboard" → ROUTES.dashboard
  Line 135: "/login" → ROUTES.login

Login.tsx:
  Line 29, 65, 98: "/dashboard" → ROUTES.dashboard
  Line 147: "/create-studio" → ROUTES.createStudio
```

### Priority 2 (Route Guards)

```
RouteGuards.tsx:
  Multiple lines: "/login" → ROUTES.login
  Multiple lines: "/dashboard" → ROUTES.dashboard
```

### Priority 3 (Full codebase)

```
All pages: Replace hardcoded navigate("/path") with navigate(ROUTES.path)
All pages: Replace to="/path" with to={ROUTES.path}
```

### Priority 4 (Missing routes)

```
Add to ROUTES.ts:
  createFirstAccount: "/create-first-account",
  accountLogin: "/account-login",
  personalAccounts: "/personal-accounts",
```

## 7. NotFound DEBUG OUTPUT

Proposed addition to NotFound component:

```tsx
function NotFound() {
  const availableRoutes = [
    "/ (root)",
    "/login",
    "/signup",
    "/create-studio",
    "/dashboard",
    "/studios",
    "/members",
    "/games",
    "/settings",
    "/home → /dashboard",
    "/create-first-account",
    "/account-login",
    "/personal-accounts",
    "/game/:gameId",
  ];

  return (
    <div style={{ padding: "40px", textAlign: "center", color: "#fff" }}>
      <h1>404 - Route not found</h1>
      <p>
        <strong>Current URL:</strong> {window.location.pathname}
      </p>

      <details
        style={{
          marginTop: "24px",
          textAlign: "left",
          background: "#1f2937",
          padding: "16px",
          borderRadius: "8px",
        }}>
        <summary style={{ cursor: "pointer", color: "#60a5fa" }}>
          Available routes
        </summary>
        <ul style={{ marginTop: "12px", fontSize: "12px", color: "#9ca3af" }}>
          {availableRoutes.map((route) => (
            <li key={route}>{route}</li>
          ))}
        </ul>
      </details>

      <a
        href="/login"
        style={{
          color: "#60a5fa",
          textDecoration: "underline",
          marginTop: "24px",
          display: "inline-block",
        }}>
        Go to login
      </a>
    </div>
  );
}
```
