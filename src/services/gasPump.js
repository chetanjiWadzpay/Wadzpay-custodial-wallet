// src/services/gasPump.js
import fetch from 'node-fetch';
import { TATUM_API_KEY } from '../config.js';

const BASE = 'https://api.tatum.io/v3';

function checkKey() {
  if (!process.env.TATUM_API_KEY && !TATUM_API_KEY) {
    throw new Error('TATUM_API_KEY missing in .env');
  }
}

async function tatumPost(path, body) {
  checkKey();
  const url = `${BASE}${path}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'x-api-key': process.env.TATUM_API_KEY || TATUM_API_KEY,
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : null
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Tatum API error: ${res.status} - ${text}`);
  return JSON.parse(text);
}

/**
 * Map common chain aliases to Tatum expected chain names.
 * Example: 'POLYGON' -> 'MATIC'
 */
export function toTatumChain(input) {
  if (!input) return input;
  const c = String(input).trim().toUpperCase();
  const map = {
    POLYGON: 'MATIC',
    MATIC: 'MATIC',
    ETH: 'ETH',
    ETHER: 'ETH',
    EVM: 'ETH',
    BSC: 'BSC',
    BINANCE: 'BSC',
    CELO: 'CELO',
    ONE: 'ONE',
    KLAY: 'KLAY',
    TRON: 'TRON'
    // add more aliases if you need them
  };
  return map[c] || c;
}

/**
 * Derive / precalculate Gas Pump addresses (POST /v3/gas-pump)
 * - chain: user-facing chain (POLYGON, ETH, BSC) — will be normalized
 * - owner: EOA owner address
 * - from, to: integer indices
 */
export async function deriveGasPumpAddresses({ chain = 'ETH', owner, from = 0, to = 0 } = {}) {
  const tatumChain = toTatumChain(chain);
  return tatumPost('/gas-pump', { chain: tatumChain, owner, from, to });
}

/**
 * createGasPumpMaster (wrapper) - convenience function kept for compatibility
 */
export async function createGasPumpMaster({ chain = 'ETH', owner, from = 0, to = 100 } = {}) {
  return deriveGasPumpAddresses({ chain, owner, from, to });
}

/**
 * Activate child address indices under master
 * POST /v3/gas-pump/activate
 */
export async function activateGasPumpIndices({ chain = 'ETH', owner, from = 0, to = 0, feesCovered = true } = {}) {
  const tatumChain = toTatumChain(chain);
  return tatumPost('/gas-pump/activate', { chain: tatumChain, owner, from, to, feesCovered });
}

/**
 * Convenience: custodial single transfer (not used by batch sweep)
 * POST /v3/blockchain/sc/custodial/transfer
 */
export async function gasPumpTransfer(payload) {
  // If payload.chain provided, normalize it
  if (payload && payload.chain) payload.chain = toTatumChain(payload.chain);
  return tatumPost('/blockchain/sc/custodial/transfer', payload);
}
