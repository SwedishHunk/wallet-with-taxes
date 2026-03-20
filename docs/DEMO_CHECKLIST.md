# Demo Checklist

This checklist is meant to make demos repeatable, calm, and easy to recover if something goes wrong.

It has three goals:
- verify the environment before anyone is watching
- show the most important product flows in a clear order
- highlight control, auditability, and security work without overselling

## 1. Demo Scope

The core story we want to show:
- a player can enter the system and trade in a game context
- the trade is attributed to the correct game
- the studio can monitor those economic events
- the platform has admin-level visibility and operational control

Secondary story:
- the system has been hardened around wallet identity, transaction replay safety, and tax/economic traceability

## 2. Pre-Demo Environment Check

Run this before every demo.

### 2.1 Start the stack

Preferred:
- VS Code: `Terminal -> Run Task -> Start All`

Manual startup order:
1. Anvil
2. Contract deploy
3. Backend
4. Frontend

### 2.2 Verify runtime health

Expected services:
- Anvil: `127.0.0.1:8545`
- Backend: `127.0.0.1:3000`
- Frontend: `127.0.0.1:5173`

Check backend health:
```powershell
Invoke-RestMethod http://127.0.0.1:3000/health | ConvertTo-Json -Depth 5
```

Expected:
- database status is healthy

Check shop config:
```powershell
Invoke-RestMethod http://127.0.0.1:3000/api/shop/config | ConvertTo-Json -Depth 5
```

Expected:
- `shopAddress` is present
- `tokenAddress` is present
- values match the latest deploy

### 2.3 Verify dev bootstrap

```powershell
$s = New-Object Microsoft.PowerShell.Commands.WebRequestSession
Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:3000/admin/dev/bootstrap" -ContentType "application/json" -Body "{}" -WebSession $s | ConvertTo-Json -Depth 6
```

Expected:
- response contains:
  - `token`
  - `studio`
  - `member`
  - `game`
  - `routes.trade`

Follow-up checks with the same session:
```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:3000/users/me" -WebSession $s | ConvertTo-Json -Depth 5
Invoke-RestMethod -Uri "http://127.0.0.1:3000/economics/studio" -WebSession $s | ConvertTo-Json -Depth 6
```

Expected:
- `/users/me` returns a user with `studioId`
- `/economics/studio` returns either an empty list or known seeded/demo data

### 2.4 Verify MetaMask state

Before demoing player trade:
- MetaMask is installed and unlocked
- MetaMask is connected to the local Anvil chain
- current account is the expected demo account
- no wrong network is selected

Quick rule:
- if MetaMask is not connected and healthy, do not start the trade demo yet

## 3. Demo Flow

Recommended order:

1. Role gateway / entry
2. Dev Quickstart
3. Player trade in game scope
4. Studio monitoring
5. Admin/platform view
6. Security and hardening summary

## 4. Feature Demo Script

### 4.1 Entry and quickstart

Show:
- landing / role gateway
- `Dev Quickstart`

Say:
- we can bootstrap a full local demo user, studio, member session, and game in one step
- this reduces setup friction and makes testing repeatable

Expected result:
- you land in a valid authenticated flow quickly

### 4.2 Player flow

Show:
- game-scoped trade route
- wallet connection state
- trade UI

Explain:
- player actions are scoped to a specific game
- game is the transaction context
- this is the most important tracking input

Perform:
- make one trade from the game route

Expected result:
- trade succeeds
- player-side activity updates

### 4.3 Studio flow

Show:
- studio dashboard
- `Player Economic Events`
- `Studio Economic Events`

Explain:
- game-level events show exact attribution for a specific game
- studio-level aggregation rolls up all relevant events for the studio

Expected result:
- the new trade appears in the right game context
- the studio aggregate reflects the event as well

### 4.4 Admin / platform flow

Show:
- Triolith admin page or platform-level admin controls

Explain:
- platform-level visibility exists above studio scope
- the company can monitor system-wide behavior, not just a single studio

Expected result:
- admin routes load
- platform controls/audit information are visible

## 5. Security and Control Talking Points

Use these as concise talking points during the demo.

### 5.1 Wallet identity
- player wallet flows no longer rely on synthetic `User` creation
- wallet identity has been separated from full user identity
- this reduces ownership ambiguity and side effects

### 5.2 Transaction correctness
- deposit confirmation validates real chain data
- key wallet mutations now support idempotency
- replay-safe transaction handling reduces duplicate writes and drift

### 5.3 Marketplace / asset safety
- marketplace purchase flow is transactional and lock-based
- this reduces race-condition risk around listings and ownership

### 5.4 Tax / economics visibility
- economic events are stored explicitly
- tax projection health is tracked
- valuation provenance is clearer than before, especially where estimates are used

### 5.5 Operational control
- quick environment checks exist
- dev bootstrap gives a consistent setup path
- disconnected wallet states now fail more gracefully in the UI

## 6. If Something Breaks During the Demo

Do not improvise too much. Use one of these fallback paths.

### 6.1 MetaMask is broken
- do not force the live trade
- show:
  - disconnected-state UX
  - studio and admin monitoring structure
  - dev bootstrap
  - already persisted demo events if available

### 6.2 Contract reads fail
Check:
1. Anvil is running
2. contracts were deployed after Anvil start
3. backend `/api/shop/config` matches latest deploy
4. MetaMask is on the same chain

### 6.3 Bootstrap fails
Check:
1. backend is on latest `main`
2. `/admin/dev/bootstrap` works by direct API call
3. cookies/session are being set

### 6.4 UI looks wrong
Check:
1. browser zoom is reset to `100%`
2. correct Vite instance is open
3. frontend has been restarted after major config changes

## 7. Demo Success Criteria

The demo is considered successful if we can show:
- stack is healthy
- quickstart works
- one trade is performed from a game route
- that trade becomes visible in studio tracking
- admin/platform visibility exists
- we can explain at least three concrete hardening improvements

## 8. Post-Demo Notes

After each demo, capture:
- what worked smoothly
- what broke
- whether the issue was:
  - environment
  - UX
  - backend logic
  - wallet/network setup
- what should be automated before the next run

Keep this file current. If the demo order changes, update the checklist before the next session.
