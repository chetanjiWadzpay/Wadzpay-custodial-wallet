// src/scripts/setupGasPumpMaster.js
import { createGasPumpMaster } from '../services/gasPump.js';
import 'dotenv/config';

async function run() {
  const owner = process.env.GAS_PUMP_MASTER || null;
  if (!owner) {
    console.error('❌ Please set GAS_PUMP_MASTER in .env (EOA owner address)');
    process.exit(1);
  }

  // allow chain from CLI (e.g. node setupGasPumpMaster.js POLYGON) or default to ENV/ETH
  const cliChain = process.argv[2] ? process.argv[2].toUpperCase() : (process.env.DEFAULT_CHAIN || 'ETH');
  const chain = cliChain;

  const from = 0;
  const to = 1; // precalc first N addresses

  console.log(`🚀 Precalculating Gas Pump child addresses (chain=${chain}, master=${owner})...`);

  try {
    // createGasPumpMaster is a wrapper around POST /v3/gas-pump
    const resp = await createGasPumpMaster({ chain, owner, from, to });
    console.log('✅ Precalculated addresses (response):', resp);
    console.log('⚠️ Note: GAS_PUMP_MASTER must be an address you control and its private key must be available for activations/sweeps.');
  } catch (err) {
    console.error('❌ Failed:', err.message);
    process.exit(1);
  }
}

run();
