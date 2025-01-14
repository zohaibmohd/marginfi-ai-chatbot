import "dotenv/config";
import { Connection, Keypair } from "@solana/web3.js";
import { NodeWallet } from "@mrgnlabs/mrgn-common";
import { MarginfiClient, getConfig, AccountType } from "@mrgnlabs/marginfi-client-v2";

/**
 * Fetch and list Marginfi Bank addresses on Devnet.
 */
async function fetchValidBanksDevnet() {
  const rpcUrl = process.env.MY_DEVNET_URL;
  console.log("MY_DEVNET_URL:", rpcUrl);

  if (!rpcUrl?.startsWith("http://") && !rpcUrl?.startsWith("https://")) {
    throw new Error(`Invalid RPC URL. Found: ${rpcUrl}`);
  }

  const pkJson = process.env.SOLANA_PRIVATE_KEY_JSON;
  if (!pkJson) {
    throw new Error("Missing SOLANA_PRIVATE_KEY_JSON in .env");
  }

  const secretKey = new Uint8Array(JSON.parse(pkJson));
  const keypair = Keypair.fromSecretKey(secretKey);
  const wallet = new NodeWallet(keypair);
  const connection = new Connection(rpcUrl, "confirmed");
  const config = getConfig("dev");
  const client = await MarginfiClient.fetch(config, wallet, connection);

  console.log("🔎 Fetching Devnet Marginfi bank addresses...");
  const bankPubKeys = await client.getAllProgramAccountAddresses(AccountType.Bank);

  console.log(`✅ Found ${bankPubKeys.length} Bank addresses on devnet.`);
  bankPubKeys.forEach((key, idx) => {
    console.log(`${idx + 1}: ${key.toBase58()}`);
  });
}

// Run the main function
fetchValidBanksDevnet().catch((err) => {
  console.error("❌ Script Error:", err.message);
});