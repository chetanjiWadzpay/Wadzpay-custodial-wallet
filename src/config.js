import dotenv from 'dotenv';
import { ethers } from 'ethers';

dotenv.config();

// Ethereum provider (mainnet default)
export const provider = new ethers.JsonRpcProvider(process.env.RPC_URL || undefined, {
  name: 'homestead',
  chainId: 1
});

// Hot wallet where swept funds go
export const HOT_WALLET = process.env.HOT_WALLET_ADDRESS;

// ERC20 contract (USDT or others)
export const USDT_ADDRESS = process.env.USDT_CONTRACT || '';

// Tatum config
export const TATUM_API_KEY = process.env.TATUM_API_KEY;

// Master (the EOA you control)
export const GAS_PUMP_MASTER = process.env.GAS_PUMP_MASTER;

// Master private key (required for transfers unless using Tatum KMS signatureId)
export const MASTER_PRIVATE_KEY = process.env.MASTER_PRIVATE_KEY;

// Convenience loader
export function loadConfig() {
  return {
    RPC_URL: process.env.RPC_URL,
    MASTER_PRIVATE_KEY: process.env.MASTER_PRIVATE_KEY,
    TATUM_API_KEY: process.env.TATUM_API_KEY,
    GAS_PUMP_MASTER: process.env.GAS_PUMP_MASTER,
    HOT_WALLET: process.env.HOT_WALLET_ADDRESS,
    USDT_CONTRACT: process.env.USDT_CONTRACT,
    APP_PORT: process.env.APP_PORT || 3000
  };
}
