 
# WadzPay — Custodial Wallet (Tatum Gas Pump / Custodial SC)

Small sample project demonstrating a custodial wallet flow using Tatum's Gas Pump / Custodial Smart Contract APIs:
- Precalculate / derive custodial child addresses for an EOA master
- Optionally activate addresses (Tatum can cover activation fees on paid plans)
- Batch sweep ERC-20 tokens and native ETH from custodial child addresses to a hot wallet using Tatum's custodial batch transfer API

> **Warning:** This project interacts with real funds on Ethereum. Do **not** commit secrets (`.env`) to git. Always rotate keys if they are exposed.

---

## Table of contents

- [Features](#features)  
- [Prerequisites](#prerequisites)  
- [Quick start](#quick-start)  
- [Environment variables](#environment-variables)  


---

## Features

- Create/derive custodial child addresses (Tatum precalc `POST /v3/gas-pump`).
- Activate child indices (`POST /v3/gas-pump/activate`).
- Batch sweep multiple assets (ERC-20 + ETH) using `POST /v3/blockchain/sc/custodial/transfer/batch`.
- Balance checks using `ethers` provider.
- Saves custodial addresses and sweep metadata to `src/db.json`.
- Redacts private keys from logs and supports Tatum KMS (`signatureId`).

---

## Prerequisites

- Node 18+ (tested)
- npm
- An Ethereum node provider (Alchemy/Infura/QuickNode) — RPC URL for mainnet or testnet
- Tatum account & API key (paid plan required for some features)
- An EOA to use as `GAS_PUMP_MASTER` (you must own its private key or store it in Tatum KMS)
- (Optional) Git and GitHub account

---

## Quick start

1. Clone repo (local) and install dependencies:

```powershell
git clone https://github.com/chetanjiWadzpay/Wadzpay-custodial-wallet
cd wadzpay-custodial-wallet
npm install

2. Create .env . Use .env.example as reference. 

3. Create custodial child addresses (precalc + activate): 

npm run setup-gasmaster   # runs src/scripts/setupGasPumpMaster.js
npm run create-wallet     # runs src/scripts/createCustodial.js
 
4. Deposit ERC-20 (e.g., USDT) to the child address and then sweep: 

npm run sweep


