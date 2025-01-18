import { Connection, Keypair } from "@solana/web3.js";
import { MarginfiClient, getConfig } from "@mrgnlabs/marginfi-client-v2";
import { NodeWallet } from "@mrgnlabs/mrgn-common";
import "dotenv/config";

/**
 * Utility to initialize and return a MarginfiClient instance.
 */
export async function getMarginfiClient(): Promise<MarginfiClient> {
  // 1) Use mainnet or devnet from environment
  //    If you want DevNet by default, replace this fallback with "https://api.devnet.solana.com"
  const RPC_URL =
    process.env.MY_MAINNET_URL || "https://mainnet.helius-rpc.com/?api-key=f494919d-87b0-4f0d-a8a3-f3c05d5e17ee";

  const connection = new Connection(RPC_URL, "confirmed");

  // 2) Load private key from .env
  const rawKey = process.env.SOLANA_PRIVATE_KEY_JSON;
  if (!rawKey) {
    throw new Error("No SOLANA_PRIVATE_KEY_JSON found in .env!");
  }
  const secretKey = new Uint8Array(JSON.parse(rawKey));
  const wallet = new NodeWallet(Keypair.fromSecretKey(secretKey));

  // 3) Production config for mainnet
  //    (If you want devnet, do getConfig("dev") instead.)
  const config = getConfig("production");

  // 4) Initialize the Marginfi client
  return await MarginfiClient.fetch(config, wallet, connection);
}