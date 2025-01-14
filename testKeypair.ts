import { Keypair } from "@solana/web3.js";

const privateKeyJson = process.env.SOLANA_PRIVATE_KEY_JSON;

if (!privateKeyJson) {
  console.error("❌ Error: SOLANA_PRIVATE_KEY_JSON secret is missing!");
  process.exit(1);
}

try {
  // Parse the JSON array and convert it to a Uint8Array
  const privateKeyArray = JSON.parse(privateKeyJson);
  const keypair = Keypair.fromSecretKey(Uint8Array.from(privateKeyArray));

  console.log("✅ Keypair successfully initialized:");
  console.log("Public Key:", keypair.publicKey.toBase58());
} catch (error) {
  console.error("❌ Error initializing Keypair:", error instanceof Error ? error.message : error);
  process.exit(1);
}