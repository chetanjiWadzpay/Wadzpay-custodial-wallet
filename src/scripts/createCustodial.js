import fs from 'fs';
import { deriveGasPumpAddresses, activateGasPumpIndices } from '../services/gasPump.js';
import 'dotenv/config';

const DB_FILE = 'src/db.json';

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
function saveWallets(wallets) {
  fs.writeFileSync(DB_FILE, JSON.stringify({ wallets }, null, 2));
}

/**
 * Derive a single child address at index (uses POST /v3/gas-pump)
 */
async function getNextChildAddress(index) {
  const owner = process.env.GAS_PUMP_MASTER;
  if (!owner) throw new Error('GAS_PUMP_MASTER not set in .env');

  // NOTE: POST /v3/gas-pump returns an array of addresses
  const resp = await deriveGasPumpAddresses({ chain: 'ETH', owner, from: index, to: index });

  if (Array.isArray(resp) && resp.length) return resp[0];
  if (resp && resp.addresses && resp.addresses.length) return resp.addresses[0];

  throw new Error('No address returned from Tatum derive endpoint');
}

/**
 * Create custodial child (precalculate + optionally activate), store in db.json
 */
export default async function createCustodialWallet() {
  try {
    const wallets = loadWallets();
    const index = wallets.length;

    console.log('Requesting child address index', index);
    const child = await getNextChildAddress(index);
    console.log('Got child address:', child);

    // Optionally activate this index so withdrawals are possible.
    // Activation requires paying gas (you can set feesCovered:true if you want Tatum to pay activation costs).
    const owner = process.env.GAS_PUMP_MASTER;
    try {
      const activationResp = await activateGasPumpIndices({
        chain: 'ETH',
        owner,
        from: index,
        to: index,
        feesCovered: true
      });
      console.log('Activation response:', activationResp);
    } catch (actErr) {
      console.warn('Activation failed or deferred:', actErr.message);
      // proceed; address can still receive deposits (withdraw requires activation)
    }

    wallets.push({
      address: child,
      index,
      createdAt: new Date().toISOString()
    });
    saveWallets(wallets);
    console.log('✅ Saved child address to db.json:', child);

    return child;
  } catch (err) {
    console.error('Error creating custodial wallet:', err.message);
    throw err;
  }
}

if (process.argv[1].endsWith('createCustodial.js')) {
  createCustodialWallet().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
