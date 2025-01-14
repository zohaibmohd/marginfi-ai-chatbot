import dotenv from "dotenv";

// Load environment variables
dotenv.config();

console.log("🚀 Verifying secrets...");
console.log("RPC_URL:", process.env.RPC_URL || "❌ Not Found");
console.log("SOLANA_PRIVATE_KEY:", process.env.SOLANA_PRIVATE_KEY ? "✅ Loaded" : "❌ Not Found");
console.log("KEYPAIR:", process.env.KEYPAIR ? "✅ Loaded" : "❌ Not Found");
console.log("KEYPAIR_RECOVERY:", process.env.KEYPAIR_RECOVERY ? "✅ Loaded" : "❌ Not Found");
console.log("BIP39_PASSPHRASE:", process.env.BIP39_PASSPHRASE ? "✅ Loaded" : "❌ Not Found");