/**
 * marginfiClient.ts
 *
 * Purpose:
 *   - Connect to Marginfi's mainnet group via an RPC endpoint
 *   - Implements a light in-memory cache to reduce repeated fetch calls
 */

import { Connection, Keypair } from "@solana/web3.js";
import { MarginfiClient, getConfig } from "@mrgnlabs/marginfi-client-v2";
import { NodeWallet } from "@mrgnlabs/mrgn-common";
import "dotenv/config";

/**
 * Simple in-memory cache for the MarginfiClient
 */
let cachedClient: MarginfiClient | null = null;
let lastFetchTime: number | null = null;
const CACHE_TTL_MS = 30_000; // 30 seconds

export async function getMarginfiClientCached(): Promise<MarginfiClient> {
  const now = Date.now();
  if (cachedClient && lastFetchTime && now - lastFetchTime < CACHE_TTL_MS) {
    return cachedClient;
  }

  // 1) Decide which RPC to use
  let RPC_URL = process.env.MY_MAINNET_URL;
  if (!RPC_URL) {
    console.warn(
      "Warning: No MY_MAINNET_URL set. Falling back to default mainnet-beta..."
    );
    RPC_URL = "https://api.mainnet-beta.solana.com";
  }

  const connection = new Connection(RPC_URL, {
    commitment: "confirmed",
    confirmTransactionInitialTimeout: 120_000,
  });

  // 2) Attempt to read a local private key if you do on-chain tx
  const rawKey = process.env.SOLANA_PRIVATE_KEY_JSON;
  if (!rawKey) {
    throw new Error("❌ Missing SOLANA_PRIVATE_KEY_JSON in environment!");
  }

  let parsedKey: number[] | null = null;
  try {
    parsedKey = JSON.parse(rawKey);
    if (!Array.isArray(parsedKey)) {
      throw new Error("SOLANA_PRIVATE_KEY_JSON is not an array!");
    }
  } catch (err) {
    throw new Error(`❌ SOLANA_PRIVATE_KEY_JSON invalid JSON => ${err}`);
  }

  const secretKey = new Uint8Array(parsedKey);
  const wallet = new NodeWallet(Keypair.fromSecretKey(secretKey));

  // 3) Official marginfi mainnet config => 'production'
  const baseConfig = getConfig("production");

  // 4) Build the fresh client
  const client = await MarginfiClient.fetch(baseConfig, wallet, connection);
  cachedClient = client;
  lastFetchTime = now;

  console.log(
    "=> marginfiClient: Fetched fresh data from group",
    baseConfig.groupPk.toBase58(),
    `, found ${client.banks.size} banks.`
  );

  return client;
}