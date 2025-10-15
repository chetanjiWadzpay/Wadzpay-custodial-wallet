// src/scripts/createCustodial.js
import fs from 'fs';
import { deriveGasPumpAddresses, activateGasPumpIndices } from '../services/gasPump.js';
import 'dotenv/config';
import { DEFAULT_CHAIN, getProvider } from '../config.js';
import { ethers } from 'ethers';

const DB_FILE = 'src/db.json';

/**
 * Load saved wallets (child custodial addresses)
 */
function loadWallets() {
  if (!fs.existsSync(DB_FILE)) return [];
  const raw = fs.readFileSync(DB_FILE, 'utf8').trim();
  if (!raw) return [];
  try {
    const db = JSON.parse(raw);
    return db.wallets || [];
  } catch {
    return [];
  }
}

/**
 * Save wallets back to db.json
 */
function saveWallets(wallets) {
  fs.writeFileSync(DB_FILE, JSON.stringify({ wallets }, null, 2));
}

/**
 * Derive a single child address at index (uses POST /v3/gas-pump)
 */
async function getNextChildAddress(index, chain) {
  const owner = process.env.GAS_PUMP_MASTER;
  if (!owner) throw new Error('GAS_PUMP_MASTER not set in .env');

  const resp = await deriveGasPumpAddresses({ chain, owner, from: index, to: index });

  if (Array.isArray(resp) && resp.length) return resp[0];
  if (resp && resp.addresses && resp.addresses.length) return resp.addresses[0];

  throw new Error('No address returned from Tatum derive endpoint');
}

/**
 * Wait for contract deployment confirmation using getCode()
 * Polls every 10s up to 6 times (~1 min total)
 */
async function confirmDeployment(chain, childAddress) {
  const provider = getProvider(chain);
  let code = await provider.getCode(childAddress);

  if (code !== '0x' && code.length > 2) {
    console.log(`✅ Contract already deployed at ${childAddress} on ${chain}.`);
    return true;
  }

  console.log(`⏳ Waiting for deployment of ${childAddress} on ${chain}...`);
  for (let i = 0; i < 6; i++) {
    await new Promise(r => setTimeout(r, 10000)); // wait 10s
    code = await provider.getCode(childAddress);
    if (code !== '0x' && code.length > 2) {
      console.log(`✅ Contract successfully deployed at ${childAddress} on ${chain}.`);
      return true;
    }
    console.log(`...still waiting (${i + 1}/6)`);
  }

  console.warn(`❌ Contract not deployed at ${childAddress} on ${chain} after waiting.`);
  return false;
}

/**
 * Create custodial child for a given chain and save it only if deployed
 */
export default async function createCustodialWallet() {
  try {
    const wallets = loadWallets();
    const index = wallets.length;
    const chain = (process.argv[2] || process.env.CHAIN || DEFAULT_CHAIN || 'ETH').toUpperCase();

    console.log(`\n🚀 Requesting child address index ${index} for chain ${chain}...`);
    const child = await getNextChildAddress(index, chain);
    console.log(`Got child address: ${child}`);

    // Activate this index so withdrawals are possible
    const owner = process.env.GAS_PUMP_MASTER;
    let activationResp;
    try {
      activationResp = await activateGasPumpIndices({
        chain,
        owner,
        from: index,
        to: index,
        feesCovered: true
      });
      console.log('Activation response:', activationResp);
    } catch (actErr) {
      console.warn('⚠️ Activation failed or deferred:', actErr.message);
    }

    // ✅ Wait for actual on-chain deployment confirmation
    const deployed = await confirmDeployment(chain, child);
    if (!deployed) {
      console.warn(`⚠️ Skipping save — child address ${child} not yet deployed on ${chain}.`);
      return;
    }

    // Save child address once confirmed deployed
    wallets.push({
      address: child,
      index,
      chain,
      activatedTx: activationResp?.txId || null,
      createdAt: new Date().toISOString(),
      confirmedDeployed: true
    });
    saveWallets(wallets);
    console.log(`✅ Saved deployed child address to db.json: ${child}`);

    return child;
  } catch (err) {
    console.error('❌ Error creating custodial wallet:', err.message);
    throw err;
  }
}

// Allow running directly from CLI
if (process.argv[1].endsWith('createCustodial.js')) {
  createCustodialWallet().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
