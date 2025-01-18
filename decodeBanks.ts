import "dotenv/config";
import { getMarginfiClient } from "./utils/marginfiClient";
import { PublicKey } from "@solana/web3.js";

async function main() {
  try {
    // 1) Build the MarginfiClient
    const client = await getMarginfiClient();
    console.log(`✅ Loaded MarginfiClient on environment: ${client.config.environment}\n`);

    // 2) Fetch all banks known to the client
    const bankEntries = Array.from(client.banks.entries());
    if (bankEntries.length === 0) {
      throw new Error("No banks found via marginfiClient.banks. Check your environment setup.");
    }

    console.log(`🔎 Found ${bankEntries.length} banks.\n`);

    // 3) Iterate through all banks & print their key metrics
    for (const [bankAddress, bank] of bankEntries) {
      const { lendingRate, borrowingRate } = bank.computeInterestRates();
      const utilization = bank.computeUtilizationRate();

      // If the bank has a tokenSymbol, print it, otherwise show "undefined"
      console.log(`Bank: ${bankAddress} (symbol: ${bank.tokenSymbol ?? "undefined"})`);
      console.log(`  Mint:           ${bank.mint.toBase58()}`);
      console.log(`  Lending Rate:   ${lendingRate.toNumber().toFixed(2)}%`);
      console.log(`  Borrowing Rate: ${borrowingRate.toNumber().toFixed(2)}%`);
      console.log(`  Utilization:    ${utilization.toNumber().toFixed(2)}%`);
      console.log("--------------------------------------------------------\n");
    }

    // 4A) Attempt: getBankByTokenSymbol("SOL")
    const bankSymbol = "SOL";
    const solBankBySymbol = client.getBankByTokenSymbol(bankSymbol);
    if (!solBankBySymbol) {
      console.warn(`⚠️ \`getBankByTokenSymbol("${bankSymbol}")\` => null. No bank has tokenSymbol = "SOL"`);
    } else {
      const { lendingRate, borrowingRate } = solBankBySymbol.computeInterestRates();
      console.log(`\n✨ Single Bank [${bankSymbol}] => ${solBankBySymbol.address.toBase58()}`);
      console.log(`   Lending Rate:   ${lendingRate.toNumber().toFixed(2)}%`);
      console.log(`   Borrowing Rate: ${borrowingRate.toNumber().toFixed(2)}%`);
    }

    // 4B) Alternative: getBankByMint( So1111... ) => should actually find your SOL bank
    const solMintPubkey = new PublicKey("So11111111111111111111111111111111111111112");
    const solBankByMint = client.getBankByMint(solMintPubkey);
    if (!solBankByMint) {
      console.warn(`⚠️ \`getBankByMint("${solMintPubkey}")\` => null. Strange, no bank minted with wrapped SOL.`);
    } else {
      const { lendingRate, borrowingRate } = solBankByMint.computeInterestRates();
      console.log(`\n✨ Single Bank by Mint [So111...] => ${solBankByMint.address.toBase58()}`);
      console.log(`   Lending Rate:   ${lendingRate.toNumber().toFixed(2)}%`);
      console.log(`   Borrowing Rate: ${borrowingRate.toNumber().toFixed(2)}%`);
    }

  } catch (err) {
    console.error("❌ Script Error:", err instanceof Error ? err.message : err);
  }
}

main();