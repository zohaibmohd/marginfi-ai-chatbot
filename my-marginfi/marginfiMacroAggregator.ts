/**
 * marginfiMacroAggregator.ts
 *
 * Purpose:
 *   - Macro-level aggregator for MarginFi, ignoring banks that are inactive or extremely low utilization.
 *   - Enumerates remaining banks, logs their key data (address, mint, state, TVL, etc.).
 *   - Sorts by utilization descending, then prints a final TVL summary.
 */

import { Connection, Keypair } from "@solana/web3.js";
import { MarginfiClient, getConfig } from "@mrgnlabs/marginfi-client-v2";
import { NodeWallet } from "@mrgnlabs/mrgn-common";
import BigNumber from "bignumber.js";
import "dotenv/config";

async function main() {
  // 1) Read Helius RPC URL from env
  const RPC_URL =
    process.env.HELIUS_RPC_URL ||
    "https://rpc.helius.xyz/?api-key=YOUR_HELIUS_KEY";

  // 2) Create a read-only Solana connection
  const connection = new Connection(RPC_URL, "confirmed");

  // 3) marginfi 'production' config => official mainnet group
  const marginfiConfig = getConfig("production");

  // 4) Create a dummy wallet (read-only usage)
  const dummyKeypair = Keypair.generate();
  const dummyWallet = new NodeWallet(dummyKeypair);

  // 5) Fetch MarginfiClient
  const client = await MarginfiClient.fetch(marginfiConfig, dummyWallet, connection);

  // Convert client.banks (Map) into an array for filtering/sorting
  let bankArray = Array.from(client.banks.values());

  // 6) Filter out non-"Active" banks by string comparison:
  bankArray = bankArray.filter((bank) => bank.config.operationalState === "Active");

  // 7) Sort the remaining banks by utilization descending
  bankArray.sort((a, b) => {
    const utilA = a.computeUtilizationRate().toNumber();
    const utilB = b.computeUtilizationRate().toNumber();
    return utilB - utilA; // highest utilization first
  });

  let totalTvlAllBanks = new BigNumber(0);
  let includedCount = 0;

  console.log(`\n=> marginfi production group => total banks: ${client.banks.size}`);
  console.log(`=> After filtering for "Active" => ${bankArray.length} remain.\n`);

  // 8) Optionally skip banks with <0.5% utilization
  bankArray = bankArray.filter((bank) => {
    const utilNum = bank.computeUtilizationRate().toNumber() * 100;
    return utilNum > 0.5;
  });

  console.log(`=> After skipping <0.5% utilization => ${bankArray.length} remain.\n`);

  // 9) Enumerate each bank => log state, TVL, APYs, etc.
  for (const bank of bankArray) {
    const bankAddr = bank.address.toBase58();
    const mint = bank.mint.toBase58();

    const oraclePrice = client.getOraclePriceByBank(bankAddr);
    if (!oraclePrice) {
      console.log(`Bank => ${bankAddr}\n  ❌ Missing oracle => Skipping TVL.\n`);
      continue;
    }

    // Compute TVL
    const tvl = bank.computeTvl(oraclePrice);
    totalTvlAllBanks = totalTvlAllBanks.plus(tvl);
    includedCount++;

    // Compute interest rates
    const { lendingRate, borrowingRate } = bank.computeInterestRates();
    const utilization = bank.computeUtilizationRate().multipliedBy(100);

    console.log("===== Bank Report =====");
    console.log(`Address => ${bankAddr}`);
    console.log(`Mint => ${mint}`);
    console.log(`State => ${bank.config.operationalState}`);
    console.log(`TVL => $${tvl.toFixed(2)}`);
    console.log(`Utilization => ${utilization.toFixed(2)}%`);
    console.log(`Lending APY => ${lendingRate.toFixed(2)}%`);
    console.log(`Borrowing APY => ${borrowingRate.toFixed(2)}%`);
    console.log("--------------------------------------------\n");
  }

  // 10) Final summary
  console.log("===========================================");
  console.log(`"Active" Banks => ${bankArray.length}`);
  console.log(`Banks with oracle => ${includedCount}`);
  console.log(`Total TVL (included) => $${totalTvlAllBanks.toFixed(2)}`);
  console.log("===========================================\n");
}

// Run if called directly => "npx ts-node marginfiMacroAggregator.ts"
if (require.main === module) {
  main().catch((err) => {
    console.error("Fatal error =>", err);
    process.exit(1);
  });
}