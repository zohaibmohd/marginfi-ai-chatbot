import { Connection, Keypair, PublicKey } from "@solana/web3.js"; // Solana Web3.js library
import { MarginfiClient, getConfig, AccountType } from "@mrgnlabs/marginfi-client-v2"; // Marginfi SDK
import { NodeWallet } from "@mrgnlabs/mrgn-common"; // NodeWallet wrapper
import bs58 from "bs58"; // To decode base58 private key
import dotenv from "dotenv"; // To load environment variables

dotenv.config(); // Initialize dotenv

// Lookup table for token mint addresses to symbols
const tokenSymbolLookup: Record<string, string> = {
  "So11111111111111111111111111111111111111112": "SOL",
  "9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E": "BTC",
  "Es9vMFrzaCERD1dLDU5k3DX3CNPCGTnT2GQTyy5yx5J": "USDT",
  "2f5wW9K57w1wQzzzo24bMgLFrSoBgKQo59aP3J59q2Gq": "USDC",
  // Add more known mint addresses here
};

/**
 * Initialize Marginfi and return the client, account, and connection.
 */
export async function initializeMarginfi() {
  const RPC_URL_DEV = process.env.RPC_URL_DEV!; // Devnet RPC URL
  const connection = new Connection(RPC_URL_DEV, "confirmed");

  const SOLANA_PRIVATE_KEY = process.env.SOLANA_PRIVATE_KEY!;
  const privateKey = bs58.decode(SOLANA_PRIVATE_KEY);
  const keypair = Keypair.fromSecretKey(privateKey);
  const wallet = new NodeWallet(keypair); // Wrap Keypair in NodeWallet

  console.log("🚀 Wallet Loaded!");
  console.log("Wallet Address:", wallet.publicKey.toBase58());

  // Initialize Marginfi Client
  const config = getConfig("dev");
  const client = await MarginfiClient.fetch(config, wallet, connection);
  console.log("🚀 Marginfi Client Initialized!");

  // Fetch Marginfi Account
  const marginfiAccounts = await client.getMarginfiAccountsForAuthority();
  if (marginfiAccounts.length === 0) {
    throw new Error("No Marginfi accounts found! Create one first.");
  }

  const marginfiAccount = marginfiAccounts[0]; // Use the first account
  console.log("Using Marginfi Account:", marginfiAccount.address.toBase58());

  return { client, marginfiAccount, connection };
}

/**
 * List all banks available on the Marginfi protocol manually.
 */
export async function listBanksManual() {
  const { client, connection } = await initializeMarginfi();
  console.log("🚀 Fetching all banks manually...");

  // Fetch all bank public keys
  const bankPubkeys = await client.getAllProgramAccountAddresses(AccountType.Bank);
  if (!bankPubkeys || bankPubkeys.length === 0) {
    console.log("❌ No banks found on Devnet.");
    return;
  }

  console.log(`✅ Found ${bankPubkeys.length} banks:`);
  for (const pubkey of bankPubkeys) {
    console.log(`- Bank Address: ${pubkey.toBase58()}`);

    // Fetch additional details
    const accountInfo = await connection.getAccountInfo(pubkey);
    if (accountInfo) {
      console.log(`  Data Size: ${accountInfo.data.length} bytes`);

      // Decode token mint address (example: first 32 bytes as mint address)
      const tokenMintAddress = accountInfo.data.slice(0, 32); // Adjust based on actual structure
      const mintPublicKey = new PublicKey(tokenMintAddress);

      const tokenSymbol = tokenSymbolLookup[mintPublicKey.toBase58()] || "Unknown";
      console.log(`  Token Mint Address: ${mintPublicKey.toBase58()}`);
      console.log(`  Token Symbol: ${tokenSymbol}`);
    } else {
      console.log(`  Failed to fetch details for ${pubkey.toBase58()}`);
    }
  }
}