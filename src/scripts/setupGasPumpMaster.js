import { createGasPumpMaster } from '../services/gasPump.js';
import 'dotenv/config';

async function run() {
  const owner = process.env.GAS_PUMP_MASTER || null;
  if (!owner) {
    console.error('❌ Please set GAS_PUMP_MASTER in .env (EOA owner address)');
    process.exit(1);
  }

  const from = 0;
  const to = 1; 

  console.log(`🚀 Precalculating Gas Pump child addresses (chain=ETH, master=${owner})...`);

  try {
    const resp = await createGasPumpMaster({ chain: 'ETH', owner, from, to });
    console.log('✅ Precalculated addresses (first results):', resp);
    console.log('⚠️ Note: this operation does not change .env — GAS_PUMP_MASTER must be an address you control.');
    console.log('⚠️ Activate addresses when needed using /gas-pump/activate (auto via createCustodial if enabled).');
  } catch (err) {
    console.error('❌ Failed:', err.message);
    process.exit(1);
  }
}

run();
