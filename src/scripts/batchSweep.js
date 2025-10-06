import fs from 'fs';
import 'dotenv/config';
import fetch from 'node-fetch';
import { provider, USDT_ADDRESS, HOT_WALLET, TATUM_API_KEY, GAS_PUMP_MASTER } from '../config.js';
import { getERC20Balance } from '../utils/erc20.js';
import { ethers } from 'ethers';

const DB_FILE = 'src/db.json';
const ESTIMATE_URL = 'https://api.tatum.io/v3/blockchain/estimate';
const BATCH_URL = 'https://api.tatum.io/v3/blockchain/sc/custodial/transfer/batch';

/**
 * Redact sensitive fields before logging.
 * Copies object deeply and replaces listed keys with 'REDACTED'.
 */
function redact(obj, keys = ['fromPrivateKey', 'privateKey', 'MASTER_PRIVATE_KEY', 'signatureId']) {
  try {
    const copy = JSON.parse(JSON.stringify(obj));
    function walk(o) {
      if (o && typeof o === 'object') {
        for (const k of Object.keys(o)) {
          if (keys.includes(k)) {
            o[k] = 'REDACTED';
          } else if (typeof o[k] === 'object') {
            walk(o[k]);
          }
        }
      }
    }
    walk(copy);
    return copy;
  } catch (e) {
    return { redacted: true };
  }
}

function loadWallets() {
  if (!fs.existsSync(DB_FILE)) return [];
  const raw = fs.readFileSync(DB_FILE, 'utf8') || '{}';
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

async function getEthBalance(address) {
  const balance = await provider.getBalance(address);
  return ethers.formatEther(balance); // string in ETH
}

async function estimateTx(payload) {
  const res = await fetch(ESTIMATE_URL, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'x-api-key': TATUM_API_KEY
    },
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`Estimate failed: ${JSON.stringify(data)}`);
  return data;
}

async function sendBatch(payload) {
  const res = await fetch(BATCH_URL, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'x-api-key': TATUM_API_KEY
    },
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`Batch transfer failed: ${JSON.stringify(data)}`);
  return data;
}

async function sweepWallet(wallet, wallets) {
  try {
    console.log('\n🔑 Sweeping child address:', wallet.address, 'index:', wallet.index);

    const ethBalance = await getEthBalance(wallet.address);
    const { formatted: usdtBalance } = USDT_ADDRESS
      ? await getERC20Balance(USDT_ADDRESS, wallet.address, provider)
      : { formatted: "0" };

    const recipients = [];
    const contractTypes = [];
    const tokenAddresses = [];
    const amounts = [];
    const tokenIds = [];

    // ETH sweep (skip dust below threshold)
    if (parseFloat(ethBalance) > 0.00001) {
      console.log(`🔎 Estimating ETH sweep of ${ethBalance}...`);
      await estimateTx({
        chain: 'ETH',
        type: 'TRANSFER_CUSTODIAL',
        sender: GAS_PUMP_MASTER,
        recipient: HOT_WALLET,
        custodialAddress: wallet.address,
        tokenType: 3,
        amount: parseFloat(ethBalance).toFixed(18)
      });

      recipients.push(HOT_WALLET);
      contractTypes.push(3);
      tokenAddresses.push("0");
      amounts.push(parseFloat(ethBalance).toFixed(18));
      tokenIds.push("0");
    } else {
      if (wallet.lastSweepTxId) {
        console.log(`✅ Already swept previously (tx: ${wallet.lastSweepTxId})`);
        console.log(`🔗 View on Etherscan: https://etherscan.io/tx/${wallet.lastSweepTxId}`);
      } else {
        console.log(`ℹ️ ETH balance too small to sweep (${ethBalance} ETH).`);
      }
    }

    // USDT sweep
    if (parseFloat(usdtBalance) > 0) {
      console.log(`🔎 Estimating USDT sweep of ${usdtBalance}...`);
      await estimateTx({
        chain: 'ETH',
        type: 'TRANSFER_CUSTODIAL',
        sender: GAS_PUMP_MASTER,
        recipient: HOT_WALLET,
        custodialAddress: wallet.address,
        contractAddress: USDT_ADDRESS,
        tokenType: 0,
        amount: usdtBalance
      });

      recipients.push(HOT_WALLET);
      contractTypes.push(0);
      tokenAddresses.push(USDT_ADDRESS);
      amounts.push(usdtBalance);
      tokenIds.push("0");
    } else {
      if (!recipients.length) console.log('ℹ️ No USDT balance to sweep.');
    }

    if (recipients.length === 0) {
      if (!wallet.lastSweepTxId) console.log('ℹ️ Nothing to sweep from this wallet.');
      return;
    }

    // Build batch payload. Prefer signatureId if provided (Tatum KMS), else use fromPrivateKey.
    const payload = {
      chain: 'ETH',
      custodialAddress: wallet.address,
      sender: GAS_PUMP_MASTER,
      recipient: recipients,
      contractType: contractTypes,
      tokenAddress: tokenAddresses,
      amount: amounts,
      tokenId: tokenIds
    };

    if (process.env.SIGNATURE_ID) {
      payload.signatureId = process.env.SIGNATURE_ID;
    } else {
      // NOTE: we add fromPrivateKey only in payload sent to Tatum, avoid logging it.
      payload.fromPrivateKey = process.env.MASTER_PRIVATE_KEY;
    }

    // Log redacted payload only (do NOT log raw private key)
    console.log('📤 Batch sweep payload (redacted):', JSON.stringify(redact(payload), null, 2));

    const data = await sendBatch(payload);
    console.log('✅ Batch sweep response:', data);

    if (data.txId) {
      console.log(`🔗 View on Etherscan: https://etherscan.io/tx/${data.txId}`);
    } else {
      console.log('ℹ️ No txId returned in response. Check Tatum dashboard logs.');
    }

    wallet.lastSweepTxId = data.txId || null;
    wallet.swept = true;
    wallet.lastSweepAt = new Date().toISOString();
    saveWallets(wallets);

  } catch (err) {
    console.error('❌ Error sweeping wallet:', err.message);
  }
}

export async function runBatchSweep() {
  console.log('🚀 Starting batch sweep via Tatum Gas Pump (batch custodial transfer)...');
  const wallets = loadWallets();
  console.log('Wallet count:', wallets.length);
  for (const w of wallets) {
    await sweepWallet(w, wallets);
  }
  console.log('🎉 Batch sweep complete.');
  return { swept: wallets.length };
}

if (process.argv[1].endsWith('batchSweep.js')) {
  runBatchSweep().catch(err => {
    console.error('Fatal error in sweep:', err);
    process.exit(1);
  });
}
