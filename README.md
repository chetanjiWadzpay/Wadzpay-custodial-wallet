 
Wadzpay — Custodial Wallet (Gas Pump / Tatum)

Multi-chain: Ethereum, Polygon, BSC (works with Tatum custodial / gas-pump APIs)
This repository implements a custodial wallet flow using Tatum’s Gas Pump / Custodial Smart Contract APIs: derive/activate child custodial addresses, accept deposits, and batch-sweep ERC-20 + native assets to a hot wallet. The code includes multi-chain support (ETH, POLYGON → mapped to Tatum MATIC, BSC), estimate → batch transfer flow, and safe logging (sensitive fields redacted).


## Quick Links

Scripts:

node src/scripts/setupGasPumpMaster.js [CHAIN] — precalculate child addresses for master

node src/scripts/createCustodial.js [CHAIN] — derive + activate + confirm deployment child

node src/scripts/batchSweep.js — estimate & batch-sweep child → hot wallet (multi-chain)

Config: src/config.js

DB file: src/db.json (stores wallets list)

---

## Table of contents

- [Project Overview](#project-overview) 
- [Features](#features)  
- [Prerequisites](#prerequisites)  
- [Quick start](#quick-start)  
- [Environment variables](#environment-variables)  


---
## Project Overview 
#Uses Tatum custodial/gas-pump endpoints to derive child custodial addresses and perform batch custodial transfers.

#Supports multiple chains: Ethereum, Polygon (mapped to Tatum MATIC), BSC.

#Uses an on-disk src/db.json to track created wallets and sweep metadata.

#batchSweep.js does: read wallets → for each wallet detect chain → estimate via /v3/blockchain/estimate → submit /v3/blockchain/sc/custodial/transfer/batch (uses signatureId if present, otherwise MASTER_PRIVATE_KEY).

#Sensitive keys are redacted from logs.


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

3. ## — Usage / Commands
Precalculate Gas Pump (master) child addresses (per chain)

Precomputes an array of children for your master. Chain aliases are supported (POLYGON → MATIC).
# defaults to DEFAULT_CHAIN if not specified
node src/scripts/setupGasPumpMaster.js ETH
node src/scripts/setupGasPumpMaster.js POLYGON   # mapped to MATIC for Tatum
node src/scripts/setupGasPumpMaster.js BSC


#Create a custodial child (derive + activate + confirm on-chain)

Creates a single child index (index = current wallets.length) and activates it (attempts feesCovered:true).

node src/scripts/createCustodial.js ETH
node src/scripts/createCustodial.js POLYGON
node src/scripts/createCustodial.js BSC

* The script waits for on-chain contract code to appear (polls getCode() up to ~1 minute). If no code appears it will skip saving; re-run later.
4. Deposit ERC-20 (e.g., USDT) to the child address and then sweep: 


#Run batch sweep (estimate → batch transfer)

Reads src/db.json wallets and sweeps assets (native + ERC-20 configured per chain) to hot wallet.

npm run sweep
# or
node src/scripts/batchSweep.js 

*The script prints redacted payloads and explorer links (Etherscan / Polygonscan / Bscscan) when Tatum returns a txId. 



#How sweep works (high-level)

For each child wallet in src/db.json:

Detect wallet.chain (or fallback DEFAULT_CHAIN).

Use the chain-specific provider (RPC) to read native balance and ERC-20 balance(s).

If balance(s) exceed thresholds, call Tatum /v3/blockchain/estimate with type: TRANSFER_CUSTODIAL to confirm validity and gas.

If estimate succeeds, call /v3/blockchain/sc/custodial/transfer/batch with arrays: recipient[], contractType[], tokenAddress[], amount[], tokenId[].

Request uses signatureId if present (preferred), else fromPrivateKey (fallback).

Store lastSweepTxId, swept: true, lastSweepAt in src/db.json and print explorer link.



##src/db.json (example)
{
  "wallets": [
    {
      "address": "0xChildAddress1",
      "index": 0,
      "chain": "ETH",
      "activatedTx": "0x...",
      "createdAt": "2025-09-29T10:40:30.434Z",
      "confirmedDeployed": true,
      "swept": true,
      "lastSweepAt": "2025-09-29T12:18:39.385Z",
      "lastSweepTxId": "0x..."
    }
  ]
}

##Troubleshooting — common errors & fixes 
1. fee cap less than block base fee (gas fee error)

Tatum’s gas parameters may be too low for the current base fee. Options:

Retry later when network gas is lower.

Consult Tatum to increase fee caps for your account or use KMS billing options. 

2. Ownable: caller is not the owner

Ensure GAS_PUMP_MASTER (address) and the signer (MASTER_PRIVATE_KEY or SIGNATURE_ID) belong to the same EOA. If using signatureId, ensure it is for the master EOA. 

3. txId returned but not on explorer

Check chain sent (use toTatumChain mapping).

Open the Tatum dashboard logs (error response includes dashboardLog link) for more details.

Sometimes the transfer shows as an internal transaction — check explorer’s “Internal Txns” tab. 




