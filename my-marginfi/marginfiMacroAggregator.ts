/**
 * marginfiMacroAggregator.ts
 *
 * Purpose:
 *  - Macro-level aggregator for MarginFi, skipping banks that are inactive or very low utilization.
 *  - Logs each bank's address, mint, state, TVL, utilization, interest rates.
 *  - Sorts by utilization descending, filters out banks below 0.5% utilization.
 *  - Summarizes total TVL of the included banks at the end.
 */

import { Connection, Keypair } from "@solana/web3.js";
import { MarginfiClient, getConfig, OperationalState } from "@mrgnlabs/marginfi-client-v2";
import { NodeWallet } from "@mrgnlabs/mrgn-common";
import BigNumber from "bignumber.js";
import "dotenv/config";

async function main() {
  // 1) Read Helius RPC URL from env
  const RPC_URL =
    process.env.HELIUS_RPC_URL ||
    "https://rpc.helius.xyz/?api-key=YOUR_HELIUS_KEY";

  // 2) Create read-only Solana connection
  const connection = new Connection(RPC_URL, "confirmed");

  // 3) marginfi "production" config => mainnet group
  const marginfiConfig = getConfig("production");

  // 4) Create a dummy wallet (read-only usage)
  const dummyKeypair = Keypair.generate();
  const dummyWallet = new NodeWallet(dummyKeypair);
  const client = await MarginfiClient.fetch(marginfiConfig, dummyWallet, connection);

  // Convert the `client.banks` Map to an array for sorting/filtering
  let bankArray = Array.from(client.banks.values());

  // 5) Filter out banks that are NOT "Active"
  //    The correct enum value is OperationalState.Active, not ACTIVE
  bankArray = bankArray.filter(
    (bank) => bank.config.operationalState === OperationalState.Active
  );

  // 6) Sort by utilization descending
  bankArray.sort((a, b) => {
    const utilA = a.computeUtilizationRate().toNumber();
    const utilB = b.computeUtilizationRate().toNumber();
    return utilB - utilA; // highest utilization first
  });

  // We'll track total TVL
  let totalTvlAllBanks = new BigNumber(0);
  let includedCount = 0;

  console.log(
    `\n=> marginfi production group => total banks: ${client.banks.size}`
  );
  console.log(
    `=> After filtering only Active => ${bankArray.length} banks remain.\n`
  );

  // 7) Optionally skip banks under 0.5% utilization
  bankArray = bankArray.filter((bank) => {
    const utilNum = bank.computeUtilizationRate().toNumber() * 100;
    return utilNum > 0.5;
  });

  console.log(
    `=> After skipping <0.5% utilization => ${bankArray.length} banks remain.\n`
  );

  // 8) Enumerate each bank => log state, TVL, utilization, etc.
  for (const bank of bankArray) {
    const bankAddr = bank.address.toBase58();
    const mint = bank.mint.toBase58();

    const oraclePrice = client.getOraclePriceByBank(bankAddr);
    if (!oraclePrice) {
      console.log(`Bank => ${bankAddr}\n  ❌ Missing oracle => Skipping TVL calc.\n`);
      continue;
    }

    const tvl = bank.computeTvl(oraclePrice);
    totalTvlAllBanks = totalTvlAllBanks.plus(tvl);
    includedCount++;

    // compute interest rates
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

  // 9) Print final summary
  console.log("===========================================");
  console.log(`Active Banks => ${bankArray.length}`);
  console.log(`Banks with oracle => ${includedCount}`);
  console.log(`Total TVL (those included) => $${totalTvlAllBanks.toFixed(2)}`);
  console.log("===========================================\n");
}

// Run if called from CLI: "npx ts-node marginfiMacroAggregator.ts"
if (require.main === module) {
  main().catch((err) => {
    console.error("Fatal error =>", err);
    process.exit(1);
  });
}