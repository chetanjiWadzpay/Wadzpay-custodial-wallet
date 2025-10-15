import dotenv from 'dotenv';
import { ethers } from 'ethers';

dotenv.config();

// Chain constants used across the app
export const CHAINS = {
  ETH: { name: 'ETH', tatum: 'ETH', chainId: 1 },
  POLYGON: { name: 'POLYGON', tatum: 'MATIC', chainId: 137 },
  BSC: { name: 'BSC', tatum: 'BSC', chainId: 56 }
};

// Provide a provider for a given chain key ('ETH'|'POLYGON'|'BSC')
export function getProvider(chain = 'ETH') {
  const key = (chain || 'ETH').toUpperCase();
  if (key === 'POLYGON') {
    return new ethers.JsonRpcProvider(process.env.RPC_URL_POLYGON || undefined, {
      name: 'polygon',
      chainId: CHAINS.POLYGON.chainId
    });
  }
  if (key === 'BSC') {
    return new ethers.JsonRpcProvider(process.env.RPC_URL_BSC || undefined, {
      name: 'bsc',
      chainId: CHAINS.BSC.chainId
    });
  }
  // default = ETH
  return new ethers.JsonRpcProvider(process.env.RPC_URL_ETH || process.env.RPC_URL || undefined, {
    name: 'homestead',
    chainId: CHAINS.ETH.chainId
  });
}

// Hot wallet addresses per chain (fallback to HOT_WALLET_DEFAULT)
export const HOT_WALLET_BY_CHAIN = {
  ETH: process.env.HOT_WALLET_ETH || process.env.HOT_WALLET_DEFAULT,
  POLYGON: process.env.HOT_WALLET_POLYGON || process.env.HOT_WALLET_DEFAULT,
  BSC: process.env.HOT_WALLET_BSC || process.env.HOT_WALLET_DEFAULT
};

// Token addresses map (per chain)
export const USDT_BY_CHAIN = {
  ETH: process.env.USDT_CONTRACT_ETH || '',
  POLYGON: process.env.USDT_CONTRACT_POLYGON || '',
  BSC: process.env.USDT_CONTRACT_BSC || ''
};

export const TATUM_API_KEY = process.env.TATUM_API_KEY;
export const GAS_PUMP_MASTER = process.env.GAS_PUMP_MASTER;
export const MASTER_PRIVATE_KEY = process.env.MASTER_PRIVATE_KEY;
export const SIGNATURE_ID = process.env.SIGNATURE_ID || '';
export const DEFAULT_CHAIN = (process.env.DEFAULT_CHAIN || 'ETH').toUpperCase();

export function loadConfig() {
  return {
    DEFAULT_CHAIN,
    RPC_URL_ETH: process.env.RPC_URL_ETH,
    RPC_URL_POLYGON: process.env.RPC_URL_POLYGON,
    RPC_URL_BSC: process.env.RPC_URL_BSC,
    TATUM_API_KEY: process.env.TATUM_API_KEY,
    GAS_PUMP_MASTER: process.env.GAS_PUMP_MASTER,
    MASTER_PRIVATE_KEY: process.env.MASTER_PRIVATE_KEY,
    SIGNATURE_ID: process.env.SIGNATURE_ID,
    HOT_WALLET_BY_CHAIN,
    USDT_BY_CHAIN
  };
}
