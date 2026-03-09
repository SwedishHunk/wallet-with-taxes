# Local TokenShop Integration Runbook

This is the shortest reproducible flow for verifying the `wallet-with-taxes` side against a local `TokenShop` on Anvil.

## Prerequisites

- `anvil` installed
- `forge` installed
- `wallet-with-taxes` available at:
  - `d:\VSC\LIA 2\Inner-Wallet\wallet-with-taxes`
- `trolith-studio-token` available at:
  - `d:\VSC\LIA 2\Inner-Wallet\trolith-studio-token`
- PostgreSQL running for `wallet-with-taxes`

## 1. Start Anvil

In terminal 1:

```powershell
anvil
```

Expected:

```text
Listening on 127.0.0.1:8545
```

## 2. Deploy TRI + TaxProcessor + TokenShop

In terminal 2:

```powershell
cd "D:\VSC\LIA 2\Inner-Wallet\trolith-studio-token"
git submodule update --init --recursive
forge script script/DeployIntegration.s.sol --tc DeployIntegration --rpc-url http://127.0.0.1:8545 --broadcast
```

Expected addresses on a fresh Anvil chain:

```text
TRI token:     0x5FbDB2315678afecb367f032d93F642f64180aa3
TaxProcessor:  0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
TokenShop:     0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0
```

## 3. Configure wallet-with-taxes backend

In [backend/.env](/d:/VSC/LIA%202/Inner-Wallet/wallet-with-taxes/backend/.env), make sure these values are set:

```env
PORT=3000
RPC_URL=http://127.0.0.1:8545
TOKENSHOP_ADDRESS=0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0
```

Important:
- use `127.0.0.1`, not `localhost`
- if you restart Anvil and redeploy, keep `TOKENSHOP_ADDRESS` in sync with the new deployment

Minimum env values our backend needs for this integration flow:

```env
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=wallet
DATABASE_USER=postgres
DATABASE_PASSWORD=YOUR_POSTGRES_PASSWORD
JWT_SECRET=YOUR_LOCAL_JWT_SECRET
PORT=3000
ENCRYPTION_KEY=12345678901234567890123456789012
ENCRYPTION_IV=1234567890123456
RPC_URL=http://127.0.0.1:8545
TOKENSHOP_ADDRESS=0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0
FACTORY_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
DEPLOYER_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

Notes:
- `FACTORY_ADDRESS` and `DEPLOYER_PRIVATE_KEY` are existing local-dev values used elsewhere in this repo.
- `TOKENSHOP_ADDRESS` is the key integration variable for the TokenShop listener.
- `TRI_TOKEN_ADDRESS` is optional in our current implementation because the listener can read `token()` from TokenShop.

## 3b. Configure trolith-studio-token env files

For the local integration deploy we ran, the contract deployment itself does not require a `.env` file because the script hardcodes the default Anvil deployer key in [script/DeployIntegration.s.sol](/d:/VSC/LIA%202/Inner-Wallet/trolith-studio-token/script/DeployIntegration.s.sol).

If Mohammed wants to run his backend against the same local deployment, the relevant values in `trolith-studio-token/backend/.env` are:

```env
PORT=3001
RPC_URL=http://127.0.0.1:8545
SHOP_ADDRESS=0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0
DATABASE_URL=postgresql://postgres:YOUR_POSTGRES_PASSWORD@localhost:5432/trolith_studio?schema=public
ADMIN_API_KEY=YOUR_LOCAL_ADMIN_KEY
SYNC_INTERVAL_SECONDS=15
```

Notes:
- `SHOP_ADDRESS` in Mohammed's repo is the same contract as our `TOKENSHOP_ADDRESS`.
- Their backend needs its own PostgreSQL database, separate from `wallet-with-taxes`.
- `PORT` can be `3001` or any free local port, as long as they stay consistent in their frontend/backend setup.

## 4. Start wallet-with-taxes backend

In terminal 3:

```powershell
cd "D:\VSC\LIA 2\Inner-Wallet\wallet-with-taxes\backend"
npm run start
```

Healthy state:
- Nest starts successfully
- no `JsonRpcProvider failed to detect network`
- no `TokenShop listener disabled`

## 5. Verify contract wiring

In terminal 4:

```powershell
cast call 0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0 "token()(address)" --rpc-url http://127.0.0.1:8545
```

Expected:

```text
0x5FbDB2315678afecb367f032d93F642f64180aa3
```

## 6. Execute a buy trade

User account 1 private key:

```text
0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
```

Buy 10 TRI for 0.01 ETH:

```powershell
cast send 0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0 "buyETH(uint256)" 0 --value 10000000000000000 --private-key 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d --rpc-url http://127.0.0.1:8545
```

Verify ingestion:

```powershell
Invoke-WebRequest -Uri "http://127.0.0.1:3000/tax/export?user=0x70997970C51812dc3A010C7d01b50e0d17dc79C8" | Select-Object -ExpandProperty Content
```

Expected CSV row:

```csv
Date,Type,Asset,TokenID,Amount,PriceUSD,FeeUSD
...,acquisition,tri,0,10,0.001,0
```

## 7. Execute a realized gain scenario

Admin private key:

```text
0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

Raise sell value so the user realizes a gain:

```powershell
cast send 0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0 "setRates(address,uint256,uint256)" 0x0000000000000000000000000000000000000000 1000000000000000000000 500000000000000000000 --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 --rpc-url http://127.0.0.1:8545
cast send 0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0 --value 1000000000000000000 --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 --rpc-url http://127.0.0.1:8545
cast send 0x5FbDB2315678afecb367f032d93F642f64180aa3 "approve(address,uint256)" 0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0 10000000000000000000 --private-key 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d --rpc-url http://127.0.0.1:8545
cast send 0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0 "sellToETH(uint256,uint256)" 10000000000000000000 0 --private-key 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d --rpc-url http://127.0.0.1:8545
```

## 8. Verify tax summary

```powershell
Invoke-RestMethod -Method Get -Uri "http://127.0.0.1:3000/tax/summary?user=0x70997970C51812dc3A010C7d01b50e0d17dc79C8" | ConvertTo-Json
```

Expected:

```json
{
  "totalGainsUSD": 0.01,
  "totalLossesUSD": 0,
  "adjustedLossesUSD": 0,
  "netTaxableGainUSD": 0.01
}
```

And export should now show both acquisition and disposal:

```csv
Date,Type,Asset,TokenID,Amount,PriceUSD,FeeUSD
...,acquisition,tri,0,10,0.001,0
...,disposal,tri,0,10,0.002,0
```

## Troubleshooting

- `JsonRpcProvider failed to detect network`
  - check that Anvil is running
  - check `RPC_URL=http://127.0.0.1:8545`

- `could not decode result data` for `token()`
  - `TOKENSHOP_ADDRESS` points to an address where TokenShop is not deployed on the current Anvil session
  - redeploy and update the address

- summary stays zero after only a buy
  - expected; no gain/loss is realized until a disposal happens

- sell fails with allowance error
  - run the TRI `approve(...)` step first
