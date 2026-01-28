## Wallet System for Triolith – Proof of Concept
Author
MashaVaverova – Solidity, backend & protocol development.

This a next-generation modular Web3 platform combining NFT-based asset ownership, wallet abstraction, tax compliance, and marketplace infrastructure. 
This repository contains the full-stack proof of concept (PoC), including smart contracts, a NestJS backend, and a frontend UI.
Tests exist ONLY FOR MAIN FLOW for now
Smart contracts part is fully documented 

---

## Overview

The system enables users to:

- Own assets through upgradeable smart wallet contracts
- Buy and sell ERC-1155 NFTs in a decentralized marketplace
- Log tax-relevant events (acquisition, disposal) in real-time
- Track trades and fees through a trusted relayer
- View real-time tax summaries (planned)
- Export year-end tax data (planned)

This monorepo supports a modular architecture for production scalability, while the current focus is on demonstrating core functionalities.

---

## Tech Stack

### Smart Contracts (Solidity) DONE AS POC
- `GenesisWalletFactory`: Deploys upgradeable user wallets
- `GenesisWallet`: User wallet with ERC-2771 support and restricted modules
- `Marketplace`: Fixed-price NFT trading with TRI token payments, 5% fee, capped at 100 TRI
- `FeeDistributor`: Handles protocol fee splitting
- `ERC1155`: Token standard used for digital assets

### Backend (NestJS) DONE AS POC
- Custodial user registration and wallet creation
- JWT-based authentication
- NFT listing and trading via Ethers.js + relayer
- Tax event logging (acquisition, disposal)
- PostgreSQL + TypeORM

### Frontend (partly done)
- Connect wallet / login with email
- View marketplace listings
- List NFTs and buy assets
- Real-time tax info panel
- Export tax summary (.csv)

---

## Implemented Features (PoC)

### Marketplace
- ✅ POST `/marketplace/list`: List an NFT
- ✅ POST `/marketplace/trade`: Buy an NFT (fee is distributed)
- ✅ GET `/marketplace/listings`: View all active listings

### Wallet
- ✅ Custodial Genesis wallet created on signup
- ✅ `onlyWallet` access control for certain actions

### Tax Logging
- ✅ Automatic logging of acquisition (buy) and disposal (sell)
- ✅ Timestamps, token addresses, amounts, and fee data

---

## Planned Features

- Dynamic gasless interactions via relayer
- Year-end tax export (CSV)
- Admin dashboard
- Role-based access control
- Royalty & refund support in Marketplace
