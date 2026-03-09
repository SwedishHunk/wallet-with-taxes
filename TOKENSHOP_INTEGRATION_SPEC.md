# TokenShop Integration Spec

## Scope

This document defines the practical integration work required to connect:

- `wallet-with-taxes`
- `trolith-studio-token`

The goal is to ingest TokenShop buy/sell activity into the existing tax system in `wallet-with-taxes`.

## Current State

### What already matches

- The TRI token interfaces are compatible.
- `trolith-studio-token` emits `Bought` and `Sold` events from `TokenShop`.
- `wallet-with-taxes` already has a tax persistence layer and tax summary/export API.

### What is missing in `wallet-with-taxes`

- No `TokenShop` listener module exists yet.
- No `TokenShop` ABI exists in the Nest backend.
- No environment configuration for `TOKENSHOP_ADDRESS`.
- No mapping layer from TokenShop events to `TaxEvent`.
- No reliable valuation strategy for `priceUSD` / `feeUSD`.

## Integration Target

### Source of truth

- On-chain `TokenShop` events are the source of truth for token trades.
- `wallet-with-taxes` stores normalized tax events in PostgreSQL.
- `TaxService` remains the source of truth for tax summaries and CSV export.

### Supported event types

- `Bought(user, payAsset, amountIn, genOut)`
- `Sold(user, payAsset, genIn, amountOut)`

## Required Files In `wallet-with-taxes`

### New files

- `backend/src/tokenshop/tokenshop.module.ts`
- `backend/src/tokenshop/tokenshop-listener.service.ts`
- `backend/src/shared/constants/abis/TokenShop.json`

### Existing files to modify

- `backend/src/app.module.ts`
- `backend/src/tax/tax.service.ts`
- `backend/.env` or `.env.example`

## Responsibilities

### `tokenshop.module.ts`

- Register the TokenShop listener service.
- Import any modules needed by the listener, primarily `TaxModule`.

### `tokenshop-listener.service.ts`

- Connect to chain through `ethers`.
- Read `TOKENSHOP_ADDRESS` and `RPC_URL` from env.
- Poll for `Bought` and `Sold` events on a fixed interval.
- Track last synced block.
- Transform raw chain events into `TaxEvent` rows.
- Ensure idempotency so the same event cannot be stored twice.

### `TokenShop.json`

- ABI used to decode:
  - `Bought`
  - `Sold`

Only include the ABI needed for event decoding unless broader contract interaction is required later.

## Event Mapping

### `Bought` -> `acquisition`

Map `Bought(user, payAsset, amountIn, genOut)` to:

- `type`: `acquisition`
- `userAddress`: lowercase `user`
- `assetAddress`: TRI token address, or a stable placeholder if the tax model treats TRI as the acquired asset
- `tokenId`: `0`
- `amount`: TRI amount acquired, from `genOut`
- `feeUSD`: derived from fee model or `0` initially
- `priceUSD`: derived valuation of acquired TRI

### `Sold` -> `disposal`

Map `Sold(user, payAsset, genIn, amountOut)` to:

- `type`: `disposal`
- `userAddress`: lowercase `user`
- `assetAddress`: TRI token address, or the same stable asset key used above
- `tokenId`: `0`
- `amount`: TRI amount disposed, from `genIn`
- `feeUSD`: derived from fee model or `0` initially
- `priceUSD`: derived valuation of disposed TRI

## Data Model Decision Needed

One tax-model decision must be made before implementation:

- Option A: `assetAddress` represents the TRI token being acquired/disposed.
- Option B: `assetAddress` represents the payment asset used in the trade.

Recommendation:

- Use Option A.

Reason:

- `TaxService.getSummary()` calculates cost basis by `assetAddress + tokenId`.
- For tax on token trading, the tracked asset should be the token being bought/sold, which is TRI.
- If `assetAddress` is set to ETH or USDT instead, the cost-basis chain becomes inconsistent with the intended user-facing tax report for TRI trading.

## Pricing Decision Needed

This is the main unresolved functional dependency.

`TaxService` currently depends on `priceUSD` for gain/loss calculations. TokenShop events only provide:

- payment asset
- payment amount
- TRI amount

They do not provide USD or SEK value directly.

### Minimal viable implementation

Store provisional values:

- `feeUSD = 0`
- `priceUSD` as a derived unit value from the payment leg, without market conversion

Examples:

- If `payAsset == ETH`, derive a raw unit ratio using ETH-side value, but this is not true USD.
- If `payAsset == USDT`, `priceUSD` can be approximated more realistically.

### Recommended implementation

Introduce a valuation adapter:

- Resolve `payAsset` to a market price at block time or near-trade time.
- Convert the payment leg to USD or SEK.
- Derive unit price for TRI:
  - `unitPrice = paymentValueFiat / triAmount`

Then store:

- `priceUSD = unitPrice`
- `feeUSD = feeValueFiat`

Without this, the tax summary endpoint will work technically but remain economically weak.

## Idempotency Requirements

The listener must not duplicate tax rows when restarted.

Recommended unique key:

- `txHash + logIndex`

Recommended storage options:

- Add these fields to `TaxEvent`, or
- Add a separate sync table storing processed event ids

Recommendation:

- Extend `TaxEvent` with `txHash`, `logIndex`, and `source`.

Reason:

- Easier traceability
- Easier debugging
- Simpler replay protection

## Sync Strategy

### Polling

Use polling first. It matches the existing architecture and is easier to validate locally.

Recommended loop:

- On module init, load last synced block.
- Poll every 2 to 5 seconds.
- Query `Bought` and `Sold` from `lastSyncedBlock + 1` to `latestBlock`.
- Persist new events.
- Update sync cursor only after successful persistence.

### Reorg safety

For MVP:

- Accept minimal risk and sync to latest block directly.

For stronger safety later:

- Lag by 2 to 5 confirmations.

## Environment Variables

Add to `wallet-with-taxes/backend`:

- `TOKENSHOP_ADDRESS`
- `RPC_URL`
- `TOKENSHOP_POLL_INTERVAL_MS=2000`
- optionally `TRI_TOKEN_ADDRESS`

## App Wiring

### `app.module.ts`

- Import `TokenShopModule`

### Tax module expectations

The listener should depend on `TaxService.logEvent()` and not duplicate tax business logic.

## Recommended Build Order

1. Add `TokenShop` ABI and env config.
2. Create `tokenshop.module.ts`.
3. Create `tokenshop-listener.service.ts` with polling and logging only.
4. Add idempotent persistence using `txHash + logIndex`.
5. Map `Bought`/`Sold` into `TaxService.logEvent()`.
6. Normalize wallet addresses to lowercase on both write and read paths.
7. Decide and implement `priceUSD` / `feeUSD` strategy.
8. Verify tax summary output against known buy/sell scenarios from `trolith-studio-token`.

## Verification Checklist

- A `Bought` event creates one `acquisition` row.
- A `Sold` event creates one `disposal` row.
- Restarting the backend does not duplicate rows.
- Address case differences do not break `/tax/summary?user=...`.
- CSV export includes TokenShop-generated events.
- Tax report frontend in `trolith-studio-token` can read the backend successfully.

## Main Risks

- `priceUSD` is currently underdefined for ETH-based trades.
- `TaxEvent` was originally shaped more like NFT/event logging than fungible-token trading.
- No sync cursor or source metadata exists yet in the tax model.
- Nest backend currently has an empty `EventsModule`, but that is not yet the same thing as a reusable blockchain ingestion layer.

## Recommended Next Technical Decision

Before implementation starts, align on these two questions:

1. Should TRI be the tracked taxable asset in `TaxEvent.assetAddress`?
2. Is raw placeholder valuation acceptable for MVP, or do you require actual USD/SEK valuation now?

If the answer is:

- TRI tracked asset = yes
- placeholder valuation = yes

Then the integration can be built quickly.

If actual fiat valuation is required immediately, the scope increases because pricing infrastructure must be added first.
