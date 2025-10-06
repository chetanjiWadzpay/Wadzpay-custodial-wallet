import express from "express";
import { ethers } from "ethers";
import { loadConfig } from "./config.js";
import { WalletManager } from "./services/walletManager.js";
import { runBatchSweep } from "./scripts/batchSweep.js";
import { logger } from "./utils/logger.js";

const app = express();
app.use(express.json());

const config = loadConfig();

// Setup W Chain provider
const provider = new ethers.JsonRpcProvider(config.RPC_URL, {
  chainId: 171717,
  name: "w_chain",
});

// Initialize Wallet Manager
const walletManager = new WalletManager(provider, config);

// -------------------- ROUTES -------------------- //

// Health check
app.get("/", (req, res) => {
  res.json({ status: "Custodial Wallet API running on W Chain" });
});

// Create new custodial wallet
app.post("/wallets", async (req, res) => {
  try {
    const wallet = await walletManager.createCustodialWallet();
    res.json(wallet);
  } catch (err) {
    logger.error("Error creating wallet:", err);
    res.status(500).json({ error: "Failed to create wallet" });
  }
});

// List all wallets
app.get("/wallets", async (req, res) => {
  try {
    const wallets = await walletManager.getAllWallets();
    res.json(wallets);
  } catch (err) {
    logger.error("Error fetching wallets:", err);
    res.status(500).json({ error: "Failed to fetch wallets" });
  }
});

// Trigger batch sweep manually
app.post("/sweep", async (req, res) => {
  try {
    const report = await runBatchSweep();
    res.json(report);
  } catch (err) {
    logger.error("Error running batch sweep:", err);
    res.status(500).json({ error: "Sweep failed" });
  }
});

// -------------------- SERVER -------------------- //
const PORT = config.APP_PORT || 3000;
app.listen(PORT, () => {
  logger.info(`Custodial Wallet API listening on port ${PORT} (W Chain)`);
});
