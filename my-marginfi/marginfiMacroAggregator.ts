
/**
 * marginfiMacroAggregator.ts
 *
 * Purpose:
 *  - Macro-level aggregator for MarginFi, skipping banks that are "inactive" or near-zero usage.
 *  - Logs each bank's operational state, interest rate config, utilization, APYs, etc.
 *  - Sorts by utilization descending so the most utilized banks appear first.
 *  - Summarizes total TVL for included banks at the end.
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

  // 2) Create read-only Solana connection
  const connection = new Connection(RPC_URL, "confirmed");

  // 3) marginfi "production" config => mainnet group
  const marginfiConfig = getConfig("production");

  // 4) Create dummy wallet for read-only operations
  const dummyKeypair = Keypair.generate();
  const dummyWallet = new NodeWallet(dummyKeypair);
  const client = await MarginfiClient.fetch(marginfiConfig, dummyWallet, connection);

  // Convert the `client.banks` Map into an Array so we can sort/filter
  let bankArray = Array.from(client.banks.values());

  // 5) Filter out banks that are NOT "Active"
  bankArray = bankArray.filter((bank) => bank.config.operationalState === "Active");

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
    console.log(`State => ${bank.config.operationalState}`);
    console.log(`TVL => $${tvl.toFixed(2)}`);
    console.log(`Utilization => ${utilization.toFixed(2)}%`);

    console.log(`Lending APY => ${lendingRate.toFixed(2)}%`);
    console.log(`Borrowing APY => ${borrowingRate.toFixed(2)}%`);

    console.log("Interest Rate Config =>", {
      optimalUtilizationRate: irConfig.optimalUtilizationRate?.toNumber(),
      plateauInterestRate: irConfig.plateauInterestRate?.toNumber(),
      maxInterestRate: irConfig.maxInterestRate?.toNumber(),
      insuranceFeeFixedApr: irConfig.insuranceFeeFixedApr?.toNumber(),
      insuranceIrFee: irConfig.insuranceIrFee?.toNumber(),
      protocolFixedFeeApr: irConfig.protocolFixedFeeApr?.toNumber(),
      protocolIrFee: irConfig.protocolIrFee?.toNumber(),
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
