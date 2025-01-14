import { Connection, Keypair } from "@solana/web3.js";
import bs58 from "bs58";

async function main() {
  // Load secrets
  const RPC_URL_DEV = process.env.RPC_URL_DEV!;
  const SOLANA_PRIVATE_KEY = process.env.SOLANA_PRIVATE_KEY!;

  // Decode private key and initialize wallet
  const privateKey = bs58.decode(SOLANA_PRIVATE_KEY);
  const wallet = Keypair.fromSecretKey(privateKey);

  console.log("🚀 Wallet Initialized!");
  console.log("Wallet Address:", wallet.publicKey.toBase58());

  // Connect to Solana Devnet
  const connection = new Connection(RPC_URL_DEV, "confirmed");
  console.log("Connected to Solana RPC (Devnet):", RPC_URL_DEV);

  // Check wallet balance
  const balance = await connection.getBalance(wallet.publicKey);
  console.log("Wallet Balance:", balance / 1e9, "SOL");
}

main().catch((err) => {
  console.error("❌ Error:", err);
});