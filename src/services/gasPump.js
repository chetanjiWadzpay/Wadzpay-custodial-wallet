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
 * Precalculate Gas Pump addresses (from..to)
 * Correct endpoint: POST /v3/gas-pump
 */
export async function deriveGasPumpAddresses({ chain = 'ETH', owner, from = 0, to = 0 } = {}) {
  return tatumPost('/gas-pump', { chain, owner, from, to });
}

/**
 * Create Gas Pump master (precalculate many addresses)
 * Wrapper around deriveGasPumpAddresses
 */
export async function createGasPumpMaster({ chain = 'ETH', owner, from = 0, to = 100 } = {}) {
  return deriveGasPumpAddresses({ chain, owner, from, to });
}

/**
 * Activate child address indices under master
 * Endpoint: POST /v3/gas-pump/activate
 * Use feesCovered=true if you want Tatum to pay activation fees (requires paid plan).
 */
export async function activateGasPumpIndices({ chain = 'ETH', owner, from = 0, to = 0, feesCovered = true } = {}) {
  return tatumPost('/gas-pump/activate', { chain, owner, from, to, feesCovered });
}

/**
 * NOTE: We provide a convenience wrapper for the older gas-pump transfer.
 * For sweeping we will use the custodial batch transfer endpoint in the sweep script.
 */
export async function gasPumpTransfer(payload) {
  return tatumPost('/blockchain/sc/custodial/transfer', payload);
}
