# Economic Scope + Attribution V1

## Goal

Create a minimal, explicit model that lets `wallet-with-taxes` answer:

- which economic events belong to the whole ecosystem
- which belong to a studio
- which belong to a specific game
- which player generated them

This is the minimum needed for monitoring, attribution, and future analytics in the studio dashboard.

## Core Principle

Every economic event must be classified by scope.

If an event is not tied to a specific game, it must still be assigned to either:

- `global`
- `studio`

Do not leave scope implicit.

## Scope Types

### 1. `global`

Use when the event belongs to the wider Triolith ecosystem and not to a specific studio or game.

Examples:

- buy TRI with ETH
- sell TRI to ETH
- global wallet transfer
- open market transaction
- tax-relevant wallet activity outside a game

### 2. `studio`

Use when the event is shared across multiple games inside one studio or franchise.

Examples:

- studio-wide premium currency
- cross-game cosmetics
- shared wallet balance for one studio universe
- franchise-wide reward token

### 3. `game`

Use when the event belongs to one specific game only.

Examples:

- loot drop
- in-game gold spend
- character upgrade
- gear unlock
- game-specific token earn/spend

## Minimum Event Shape

Every tracked economic event should be able to resolve the following fields:

```ts
type EconomicScopeType = "global" | "studio" | "game";

type EconomicEventV1 = {
  id: string;
  source: string;
  eventType: string;

  scopeType: EconomicScopeType;

  studioId: string | null;
  gameId: string | null;

  userId: string | null;
  gamePlayerId: string | null;
  walletAddress: string | null;

  assetKey: string;
  assetSymbol: string | null;
  amount: string;

  direction: "in" | "out" | "neutral";
  timestamp: string;

  txHash: string | null;
  metadata: Record<string, unknown> | null;
};
```

## Required Attribution Rules

### Rule 1. Scope is mandatory

Every event must have `scopeType`.

### Rule 2. `global` events

For `scopeType = global`:

- `studioId = null`
- `gameId = null`

### Rule 3. `studio` events

For `scopeType = studio`:

- `studioId` is required
- `gameId = null`

### Rule 4. `game` events

For `scopeType = game`:

- `studioId` is required
- `gameId` is required

### Rule 5. Player identity

Use the strongest player identity available:

- prefer `gamePlayerId` for game-scoped events
- otherwise use `userId`
- otherwise at minimum use `walletAddress`

### Rule 6. Unknown attribution is not acceptable long-term

If an event cannot be tied to a scope, it should be marked explicitly as `global` only if that is a deliberate product decision.

Do not silently treat missing context as acceptable.

## Initial Source Mapping

### TokenShop / Player Wallet

Current recommendation:

- TRI buy/sell in `/player` defaults to `global`
- unless the player entered from a game session with explicit game context

Initial mapping:

```text
TokenShop buy TRI -> global
TokenShop sell TRI -> global
```

Future mapping:

```text
TokenShop buy/sell started inside a game-linked player session
-> scopeType = game
-> studioId from game
-> gameId from session
-> gamePlayerId from session
```

### Shared Studio Currency

Examples:

- studio premium currency top-up
- shared franchise token spend

Mapping:

```text
scopeType = studio
studioId = owning studio
gameId = null
```

### In-Game Economy

Examples:

- gold earned from quest
- loot chest opened
- mana shard consumed

Mapping:

```text
scopeType = game
studioId = game's studio
gameId = owning game
gamePlayerId = player in that game
```

## Dashboard Rules

The studio dashboard should eventually be able to filter by:

- `studio`
- `game`
- `scopeType`
- `player`
- `asset`
- `eventType`

Minimum dashboard behavior:

### Studio view

Show all events where:

- `scopeType = studio` and `studioId = current studio`
- or `scopeType = game` and the game belongs to current studio

### Global view

Show only global events when explicitly requested.

Global events should not be mixed into studio metrics by default unless product explicitly wants that.

## Product Interpretation

This model supports:

- `TRI`, `ETH`, open market assets -> usually `global`
- shared studio currencies -> `studio`
- game-local currencies like `gold`, `silver`, `wood` -> `game`

This keeps the model flexible enough for:

- one studio with many connected games
- one studio with fully separate games
- global ecosystem trading outside game context

## First Implementation Step

Do not model every game system yet.

First implement only:

1. `scopeType`
2. `studioId`
3. `gameId`
4. `userId` / `gamePlayerId`
5. explicit event attribution rules

That gives the dashboard a real monitoring spine without forcing the full item/class/talent model yet.

## Recommended Next Steps

1. Add an internal `EconomicEvent` model in backend using the fields above.
2. Decide which existing events are currently `global`.
3. Add a game-linked player session model for future `game` attribution.
4. Let studio dashboard query by `scopeType`, `studioId`, and `gameId`.
