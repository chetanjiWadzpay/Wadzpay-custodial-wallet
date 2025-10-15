// src/scripts/batchSweep.js
import fs from 'fs';
import 'dotenv/config';
import fetch from 'node-fetch';
import {
  getProvider,
  USDT_BY_CHAIN,
  HOT_WALLET_BY_CHAIN,
  TATUM_API_KEY,
  GAS_PUMP_MASTER,
  SIGNATURE_ID
} from '../config.js';
import { getERC20Balance } from '../utils/erc20.js';
import { toTatumChain } from '../services/gasPump.js';
import { ethers } from 'ethers';

const DB_FILE = 'src/db.json';
const ESTIMATE_URL = 'https://api.tatum.io/v3/blockchain/estimate';
const BATCH_URL = 'https://api.tatum.io/v3/blockchain/sc/custodial/transfer/batch';

/** Deep-redact sensitive keys in an object copy */
function redact(obj, keys = ['fromPrivateKey', 'privateKey', 'MASTER_PRIVATE_KEY', 'signatureId']) {
  try {
    const copy = JSON.parse(JSON.stringify(obj));
    function walk(o) {
      if (!o || typeof o !== 'object') return;
      for (const k of Object.keys(o)) {
        if (keys.includes(k)) {
          o[k] = 'REDACTED';
        } else if (typeof o[k] === 'object') {
          walk(o[k]);
        }
      }
    }
    walk(copy);
    return copy;
  } catch {
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

async function getNativeBalance(provider, address) {
  const balance = await provider.getBalance(address);
  return ethers.formatEther(balance);
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

/** Resolve explorer base URL for chain (common mainnets) */
function explorerForChain(tatumChain) {
  const c = String(tatumChain).toUpperCase();
  if (c === 'ETH') return 'https://etherscan.io/tx';
  if (c === 'MATIC') return 'https://polygonscan.com/tx';
  if (c === 'BSC') return 'https://bscscan.com/tx';
  // fallback (Tatum may support others)
  return '';
}

async function sweepWallet(wallet, wallets) {
  try {
    const chainUser = (wallet.chain || process.env.CHAIN || 'ETH').toString().toUpperCase();
    const tatumChain = toTatumChain(chainUser); // normalized for Tatum (e.g. POLYGON -> MATIC)
    const provider = getProvider(chainUser);

    console.log(`\n🔑 Sweeping child address: ${wallet.address} index: ${wallet.index} chain: ${chainUser}`);

    // pick per-chain hot wallet and token config
    const hotWallet = HOT_WALLET_BY_CHAIN?.[chainUser] || HOT_WALLET_BY_CHAIN?.ETH || process.env.HOT_WALLET_DEFAULT;
    const usdtAddr = USDT_BY_CHAIN?.[chainUser] || '';

    // get balances on correct provider
    const nativeBal = await getNativeBalance(provider, wallet.address); // string ETH-like
    const { formatted: usdtBalance } = usdtAddr
      ? await getERC20Balance(usdtAddr, wallet.address, provider)
      : { formatted: '0' };

    // prepare arrays for batch transfer
    const recipients = [];
    const contractTypes = [];
    const tokenAddresses = [];
    const amounts = [];
    const tokenIds = [];

    // ETH sweep (tokenType 3, tokenAddress "0") - skip small dust
    if (parseFloat(nativeBal) > 0.00001) {
      console.log(`🔎 Estimating ${chainUser} native sweep of ${nativeBal}...`);
      await estimateTx({
        chain: tatumChain,
        type: 'TRANSFER_CUSTODIAL',
        sender: GAS_PUMP_MASTER,
        recipient: hotWallet,
        custodialAddress: wallet.address,
        tokenType: 3,
        amount: parseFloat(nativeBal).toFixed(18)
      });

      recipients.push(hotWallet);
      contractTypes.push(3);
      tokenAddresses.push('0');
      amounts.push(parseFloat(nativeBal).toFixed(18));
      tokenIds.push('0');
    } else {
      if (wallet.lastSweepTxId) {
        console.log(`✅ Already swept previously (tx: ${wallet.lastSweepTxId})`);
      } else {
        console.log(`ℹ️ ${chainUser} native balance too small to sweep (${nativeBal}).`);
      }
    }

    // ERC-20 (USDT) sweep (tokenType 0)
    if (parseFloat(usdtBalance) > 0) {
      console.log(`🔎 Estimating ${chainUser} USDT sweep of ${usdtBalance}...`);
      await estimateTx({
        chain: tatumChain,
        type: 'TRANSFER_CUSTODIAL',
        sender: GAS_PUMP_MASTER,
        recipient: hotWallet,
        custodialAddress: wallet.address,
        contractAddress: usdtAddr,
        tokenType: 0,
        amount: usdtBalance
      });

      recipients.push(hotWallet);
      contractTypes.push(0);
      tokenAddresses.push(usdtAddr);
      amounts.push(usdtBalance);
      tokenIds.push('0');
    } else {
      if (!recipients.length) console.log(`ℹ️ No USDT balance to sweep on ${chainUser}.`);
    }

    if (recipients.length === 0) {
      if (!wallet.lastSweepTxId) console.log('ℹ️ Nothing to sweep from this wallet.');
      return;
    }

    // build batch payload with chain normalized for Tatum
    const payload = {
      chain: tatumChain,
      custodialAddress: wallet.address,
      sender: GAS_PUMP_MASTER,
      recipient: recipients,
      contractType: contractTypes,
      tokenAddress: tokenAddresses,
      amount: amounts,
      tokenId: tokenIds
    };

    // prefer Tatum KMS signatureId, else fallback to MASTER_PRIVATE_KEY
    if (SIGNATURE_ID) {
      payload.signatureId = SIGNATURE_ID;
    } else if (process.env.MASTER_PRIVATE_KEY) {
      payload.fromPrivateKey = process.env.MASTER_PRIVATE_KEY;
    } else {
      console.warn('⚠️ No SIGNATURE_ID or MASTER_PRIVATE_KEY set; sweep cannot sign transaction.');
      return;
    }

    // log redacted payload (do NOT print private key)
    console.log('📤 Batch sweep payload (redacted):', JSON.stringify(redact(payload), null, 2));

    const data = await sendBatch(payload);
    console.log('✅ Batch sweep response:', data);

    if (data.txId) {
      const explorer = explorerForChain(tatumChain);
      if (explorer) console.log(`🔗 View on explorer: ${explorer}/${data.txId}`);
      else console.log(`🔗 TX ID: ${data.txId}`);
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
  console.log('🚀 Starting batch sweep across chains via Tatum custodial batch transfer...');
  const wallets = loadWallets();
  console.log('Wallet count:', wallets.length);
  for (const w of wallets) {
    await sweepWallet(w, wallets);
  }
  console.log('🎉 Batch sweep complete.');
  return { swept: wallets.length };
}

// allow running directly
if (process.argv[1].endsWith('batchSweep.js')) {
  runBatchSweep().catch(err => {
    console.error('Fatal error in sweep:', err);
    process.exit(1);
  });
}
