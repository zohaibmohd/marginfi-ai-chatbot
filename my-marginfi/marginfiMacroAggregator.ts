/**
 * marginfiMacroAggregator.ts
 *
 * Purpose:
 *  - Macro-level aggregator for MarginFi, skipping banks that are "inactive" or near-zero usage.
 *  - Logs each bank's operational state, interest rate config, utilization, APYs, etc.
 *  - Sorts by utilization descending so the most utilized banks appear first.
 *  - Summarizes total TVL for included banks at the end.
 */

import { Connection } from "@solana/web3.js";
import { MarginfiClient, getConfig } from "@mrgnlabs/marginfi-client-v2";
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

  // 4) Create read-only MarginFi client (no wallet needed)
  const client = await MarginfiClient.fetch(marginfiConfig, undefined, connection);

  // Convert the `client.banks` Map into an Array so we can sort/filter
  let bankArray = Array.from(client.banks.values());

  // 5) Filter out banks that are NOT "Active"
  bankArray = bankArray.filter((bank) => bank.operationalState === "Active");

  // 6) Sort by utilization descending
  bankArray.sort((a, b) => {
    const utilA = a.computeUtilizationRate().toNumber();
    const utilB = b.computeUtilizationRate().toNumber();
    return utilB - utilA; // highest utilization first
  });

  let totalTvlAllBanks = new BigNumber(0);
  let includedCount = 0;

  console.log(
    `\n=> marginfi production group => ${client.banks.size} total banks, skipping non-active...`
  );
  console.log(
    `=> After filter => ${bankArray.length} banks remain.\n`
  );

  // 7) Optionally skip banks with extremely low utilization (< 0.5%)
  // Comment out the next line if you want ALL active banks
  bankArray = bankArray.filter((bank) => {
    const utilNum = bank.computeUtilizationRate().toNumber() * 100;
    return utilNum > 0.5; // skip if under 0.5% utilization
  });

  console.log(
    `=> After skipping <0.5% utilization => ${bankArray.length} banks remain.\n`
  );

  // 8) Enumerate each bank => log interest rate config, utilization, TVL
  for (const bank of bankArray) {
    const bankAddr = bank.address.toBase58();
    const mint = bank.mint.toBase58();

    const oraclePrice = client.getOraclePriceByBank(bankAddr);
    if (!oraclePrice) {
      // can't compute TVL if missing oracle
      console.log(`Bank => ${bankAddr}\n  ❌ Missing oracle => Skipping TVL calc.\n`);
      continue;
    }

    const tvl = bank.computeTvl(oraclePrice);
    totalTvlAllBanks = totalTvlAllBanks.plus(tvl);
    includedCount++;

    // compute interest rates
    const { lendingRate, borrowingRate } = bank.computeInterestRates();
    const utilization = bank.computeUtilizationRate().multipliedBy(100);

    // interest rate config
    const irConfig = bank.config.interestRateConfig;

    console.log("===== Bank Report =====");
    console.log(`Address => ${bankAddr}`);
    console.log(`Mint => ${mint}`);
    console.log(`Operational State => ${bank.operationalState}`);
    console.log(`TVL => $${tvl.toFixed(2)}`);
    console.log(`Utilization => ${utilization.toFixed(2)}%`);

    console.log(`Lending APY => ${lendingRate.toFixed(2)}%`);
    console.log(`Borrowing APY => ${borrowingRate.toFixed(2)}%`);

    console.log("Interest Rate Config =>", {
      baseRate: irConfig.baseRate?.toNumber(),
      minRate: irConfig.minRate?.toNumber(),
      maxRate: irConfig.maxRate?.toNumber(),
      util0: irConfig.util0?.toNumber(),
      util1: irConfig.util1?.toNumber(),
      kinks: irConfig.kinks?.map((k) => k.toNumber()),
    });

    console.log("--------------------------------------------\n");
  }

  // 9) Summarize final counts / total TVL
  console.log("===========================================");
  console.log(`Active Banks => ${bankArray.length}`);
  console.log(`Banks with oracle => ${includedCount}`);
  console.log(`Total TVL (those included) => $${totalTvlAllBanks.toFixed(2)}`);
  console.log("===========================================\n");
}

if (require.main === module) {
  main().catch((err) => {
    console.error("Fatal error =>", err);
    process.exit(1);
  });
}