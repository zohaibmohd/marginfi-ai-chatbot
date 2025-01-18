/**
 * marginfiMacroAggregator.ts
 *
 * Purpose:
 *   - Demonstrate a macro-level aggregator for MarginFi.
 *   - Connects to MarginFi "production" group on mainnet.
 *   - Uses your Helius RPC from .env => process.env.HELIUS_RPC_URL
 *   - Enumerates each bank => computes TVL, interest rates, utilization.
 *   - Sums total TVL across all banks => prints results to console.
 */

import { Connection, Keypair } from "@solana/web3.js";
import { NodeWallet } from "@mrgnlabs/mrgn-common";
import { MarginfiClient, getConfig } from "@mrgnlabs/marginfi-client-v2";
import BigNumber from "bignumber.js";
import "dotenv/config";

async function main() {
  // 1) Read Helius RPC URL from env
  const RPC_URL =
    process.env.HELIUS_RPC_URL ||
    "https://rpc.helius.xyz/?api-key=YOUR_DEFAULT_KEY";

  // 2) Create a read-only Solana connection
  const connection = new Connection(RPC_URL, "confirmed");

  // 3) MarginFi production config => official mainnet group
  const marginfiConfig = getConfig("production");

  // 4) Create MarginFi client with dummy wallet for read-only operations
  const dummyKeypair = Keypair.generate();
  const dummyWallet = new NodeWallet(dummyKeypair);
  const client = await MarginfiClient.fetch(marginfiConfig, dummyWallet, connection);

  // We'll track total TVL across all banks
  let totalTvlAllBanks = new BigNumber(0);
  const bankCount = client.banks.size;

  console.log(
    `\n=> Found ${bankCount} banks in the MarginFi 'production' group.\n`
  );

  // 5) Enumerate each bank => compute TVL, interest rates, utilization
  for (const [bankAddr, bank] of client.banks.entries()) {
    // We need an oracle price to compute TVL
    const oraclePrice = client.getOraclePriceByBank(bankAddr);
    if (!oraclePrice) {
      console.log(`Bank => ${bankAddr}\n  ❌ Missing oracle price => Skipping TVL calc.\n`);
      continue;
    }

    // bank.computeTvl(oraclePrice) => BigNumber
    const bankTvl = bank.computeTvl(oraclePrice);
    totalTvlAllBanks = totalTvlAllBanks.plus(bankTvl);

    // compute interest rates
    const { lendingRate, borrowingRate } = bank.computeInterestRates();

    // utilization => 0..1
    const utilization = bank.computeUtilizationRate();

    console.log(`Bank => ${bankAddr}`);
    console.log(`  Mint => ${bank.mint.toBase58()}`);
    console.log(`  TVL => $${bankTvl.toFixed(2)}`);
    console.log(`  Lending APY => ${lendingRate.toFixed(2)}%`);
    console.log(`  Borrowing APY => ${borrowingRate.toFixed(2)}%`);
    console.log(
      `  Utilization => ${(utilization.multipliedBy(100)).toFixed(2)}%`
    );
    console.log();
  }

  // 6) Print overall summary
  console.log("=====================================");
  console.log(`Banks found => ${bankCount}`);
  console.log(`Total TVL => $${totalTvlAllBanks.toFixed(2)}`);
  console.log("=====================================\n");
}

// Run if called from CLI: "npx ts-node marginfiMacroAggregator.ts"
if (require.main === module) {
  main().catch((err) => {
    console.error("Fatal error =>", err);
    process.exit(1);
  });
}