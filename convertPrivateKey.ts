import bs58 from "bs58";

// Retrieve the Base58 encoded private key from the Replit secret
const base58PrivateKey = process.env.SOLANA_PRIVATE_KEY;

if (!base58PrivateKey) {
  console.error("❌ Error: SOLANA_PRIVATE_KEY environment variable is missing!");
  process.exit(1);
}

try {
  // Decode the Base58 string to a Uint8Array
  const byteArray = bs58.decode(base58PrivateKey);

  // Convert the Uint8Array to a JSON array
  const jsonArray = JSON.stringify(Array.from(byteArray));

  console.log("✅ Converted SOLANA_PRIVATE_KEY to JSON Array:");
  console.log(jsonArray);
} catch (error) {
  if (error instanceof Error) {
    // Safely access the error message
    console.error("❌ Error decoding SOLANA_PRIVATE_KEY:", error.message);
  } else {
    console.error("❌ Unknown error occurred:", error);
  }
  process.exit(1);
}