// src/index.js
import express from 'express';
import fs from 'fs';
import path from 'path';
import 'dotenv/config';

import createCustodialWallet from './scripts/createCustodial.js';
import { runBatchSweep } from './scripts/batchSweep.js';
import { createGasPumpMaster } from './services/gasPump.js';
import { loadConfig } from './config.js';

const app = express();
app.use(express.json());

// helpers
const DB_FILE = path.join(process.cwd(), 'src', 'db.json');

function readDb() {
  if (!fs.existsSync(DB_FILE)) return { wallets: [] };
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8') || '{}';
    return JSON.parse(raw);
  } catch (e) {
    return { wallets: [] };
  }
}

function writeDb(obj) {
  fs.writeFileSync(DB_FILE, JSON.stringify(obj, null, 2));
}

// Safe responder
function sendError(res, status = 500, message = 'Internal error') {
  return res.status(status).json({ ok: false, error: message });
}

app.get('/', (req, res) => {
  const cfg = loadConfig();
  res.json({
    ok: true,
    service: 'Wadzpay - Custodial Wallet API',
    env: process.env.NODE_ENV || 'development',
    defaultChain: cfg.DEFAULT_CHAIN || process.env.DEFAULT_CHAIN || 'ETH',
    docs: 'Use /wallets, /wallets/:address, /wallets (POST), /setup-master (POST), /sweep (POST)'
  });
});

/**
 * GET /wallets
 * Returns array of saved custodial child wallets from src/db.json
 */
app.get('/wallets', (req, res) => {
  try {
    const db = readDb();
    return res.json({ ok: true, wallets: db.wallets || [] });
  } catch (err) {
    return sendError(res, 500, err.message);
  }
});

/**
 * GET /wallets/:address
 * Return a single wallet entry
 */
app.get('/wallets/:address', (req, res) => {
  try {
    const addr = req.params.address;
    const db = readDb();
    const wallets = db.wallets || [];
    const w = wallets.find(x => String(x.address).toLowerCase() === String(addr).toLowerCase());
    if (!w) return sendError(res, 404, 'Wallet not found');
    return res.json({ ok: true, wallet: w });
  } catch (err) {
    return sendError(res, 500, err.message);
  }
});

/**
 * POST /wallets
 * Create a new custodial child address for a given chain.
 * Body: { chain: 'ETH'|'POLYGON'|'BSC' }  (chain optional, falls back to DEFAULT_CHAIN)
 *
 * Note: createCustodialWallet() reads process.env.CHAIN or process.argv[2].
 * We set process.env.CHAIN temporarily to pass the chain requested.
 */
app.post('/wallets', async (req, res) => {
  const { chain } = req.body || {};
  const prevChain = process.env.CHAIN;
  if (chain) process.env.CHAIN = chain;

  try {
    const child = await createCustodialWallet(); // will save to src/db.json on success
    // restore env
    if (typeof prevChain === 'undefined') delete process.env.CHAIN;
    else process.env.CHAIN = prevChain;

    // read DB to return created wallet entry
    const db = readDb();
    const saved = db.wallets?.find(w => w.address === child) || null;
    return res.json({ ok: true, created: child, wallet: saved });
  } catch (err) {
    // restore env even on error
    if (typeof prevChain === 'undefined') delete process.env.CHAIN;
    else process.env.CHAIN = prevChain;
    return sendError(res, 500, err.message);
  }
});

/**
 * POST /setup-master
 * Precalculate Gas Pump child addresses on Tatum for the master EOA.
 * Body: { chain?: 'ETH'|'POLYGON'|'BSC', from?: number, to?: number }
 */
app.post('/setup-master', async (req, res) => {
  try {
    const body = req.body || {};
    const chain = (body.chain || process.env.DEFAULT_CHAIN || 'ETH').toString().toUpperCase();
    const from = Number.isInteger(body.from) ? body.from : 0;
    const to = Number.isInteger(body.to) ? body.to : 10;

    const owner = process.env.GAS_PUMP_MASTER;
    if (!owner) return sendError(res, 400, 'GAS_PUMP_MASTER not set in .env');

    // Call createGasPumpMaster (wrapper around POST /v3/gas-pump)
    const resp = await createGasPumpMaster({ chain, owner, from, to });
    return res.json({ ok: true, chain, from, to, response: resp });
  } catch (err) {
    // If Tatum returns a JSON error string, try to include it but avoid leaking secrets
    return sendError(res, 500, err.message);
  }
});

/**
 * POST /sweep
 * Trigger batch sweep for all wallets (synchronous).
 * Body optional: { dryRun: boolean } — if dryRun true, runs estimates only (not implemented separately here)
 */
app.post('/sweep', async (req, res) => {
  try {
    // runBatchSweep performs estimate -> batch transfer, updates db.json
    const result = await runBatchSweep();
    return res.json({ ok: true, result });
  } catch (err) {
    return sendError(res, 500, err.message);
  }
});

/**
 * Simple health-check endpoint that checks DB file readable
 */
app.get('/health', (req, res) => {
  try {
    const db = readDb();
    return res.json({ ok: true, dbWalletCount: (db.wallets || []).length });
  } catch (err) {
    return sendError(res, 500, err.message);
  }
});

// Start server
const cfg = loadConfig();
const PORT = Number(process.env.APP_PORT || cfg.APP_PORT || 3000);

app.listen(PORT, () => {
  // Do not print secrets in logs
  console.log(`🚀 Wadzpay custodial API listening on port ${PORT}`);
});
