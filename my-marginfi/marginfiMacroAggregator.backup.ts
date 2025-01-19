/**
 * marginfiMacroAggregator.ts
 *
 * Purpose:
 *   - Macro-level aggregator for MarginFi, focusing on *all* banks.
 *   - Enumerates each bank, logs key data:
 *       - address, tokenSymbol, mint, state, TVL
 *       - assets, liabilities
 *       - utilization, lending APY, borrowing APY
 *   - Sorts banks by utilization descending
 *   - Summarizes the total TVL, assets, and liabilities of included banks.
 */

import { Connection, Keypair } from "@solana/web3.js";
import {
  MarginfiClient,
  getConfig,
  MarginRequirementType,
  PriceBias,
  RiskTier,
} from "@mrgnlabs/marginfi-client-v2";
import { NodeWallet } from "@mrgnlabs/mrgn-common";
import BigNumber from "bignumber.js";
import "dotenv/config";

// Define an interface for the bank report
interface BankReport {
  address: string;
  tokenSymbol: string | undefined;
  mint: string;
  state: string;
  tvl: string;
  assets: string;
  liabilities: string;
  utilization: string;
  lendingAPY: string;
  borrowingAPY: string;
}

/**
 * Maps RiskTier to MarginRequirementType.
 * Adjust the mapping based on your SDK's definitions.
 */
const mapRiskTierToMarginRequirementType = (
  riskTier: RiskTier
): MarginRequirementType => {
  switch (riskTier) {
    case RiskTier.Collateral:
      return MarginRequirementType.Equity;
    // Add additional mappings if there are more RiskTiers
    default:
      return MarginRequirementType.Equity; // Default to Equity if undefined
  }
};

async function main() {
  try {
    // 1) Read RPC URL from env or default to your Helius endpoint
    const RPC_URL =
      process.env.MY_MAINNET_URL ||
      "https://rpc.helius.xyz/?api-key=f494919d-87b0-4f0d-a8a3-f3c05d5e17ee";

    // 2) Create a Solana connection
    const connection = new Connection(RPC_URL, "confirmed");

    // 3) Get MarginFi 'production' configuration
    const marginfiConfig = getConfig("production");

    // 4) Create a dummy wallet for read-only usage
    const dummyKeypair = Keypair.generate();
    const dummyWallet = new NodeWallet(dummyKeypair);

    // 5) Fetch MarginFiClient
    const client = await MarginfiClient.fetch(
      marginfiConfig,
      dummyWallet,
      connection
    );

    // Convert client.banks (Map) to array for sorting/filtering
    let bankArray = Array.from(client.banks.values());

    console.log(`\n=> MarginFi Production Group => Total Banks: ${client.banks.size}`);

    // --- Enhanced Logging: Show states of all banks ---
    console.log("\n--- Operational States of All Banks ---");
    let operationalCount = 0;
    let reduceOnlyCount = 0;

    bankArray.forEach((bank, index) => {
      const state = bank.config.operationalState.toString();
      console.log(`Bank ${index + 1}: ${state}`);
      if (state === "Operational") operationalCount++;
      if (state === "ReduceOnly") reduceOnlyCount++;
    });

    console.log(`Total "Operational" Banks Found: ${operationalCount}`);
    console.log(`Total "ReduceOnly" Banks Found: ${reduceOnlyCount}`);
    console.log("---------------------------------------\n");

    // 6) **Remove the filter** to include all banks (65 banks)
    // No filtering is applied here.

    // 7) Sort the banks by utilization descending
    bankArray.sort((a, b) => {
      const utilA = a.computeUtilizationRate().toNumber();
      const utilB = b.computeUtilizationRate().toNumber();
      return utilB - utilA; // highest utilization first
    });

    // Initialize totals
    let totalTvlAllBanks = new BigNumber(0);
    let totalAssetsAllBanks = new BigNumber(0);
    let totalLiabilitiesAllBanks = new BigNumber(0);

    let includedCount = 0;

    // Array to hold all bank reports (optional, for exporting)
    const reports: BankReport[] = [];

    // 8) Enumerate each bank => show state, TVL, assets, liabilities, APYs, etc.
    for (const bank of bankArray) {
      const bankAddr = bank.address.toBase58();
      const mint = bank.mint.toBase58();
      const tokenSymbol = bank.tokenSymbol;

      const oraclePrice = client.getOraclePriceByBank(bankAddr);
      if (!oraclePrice) {
        console.log(`Bank => ${bankAddr}\n  ❌ Missing oracle => Skipping calculations.\n`);
        continue;
      }

      // Compute total TVL (assets + liabilities)
      const tvl = bank.computeTvl(oraclePrice);
      totalTvlAllBanks = totalTvlAllBanks.plus(tvl);

      // Retrieve required arguments for asset and liability computations
      // Attempt to access 'riskTier' from 'bank.config'
      const riskTier = (bank.config as any).riskTier as RiskTier | undefined;

      // If 'riskTier' is not available, set default values
      const marginRequirementType = riskTier
        ? mapRiskTierToMarginRequirementType(riskTier)
        : MarginRequirementType.Equity; // default value

      const priceBias = PriceBias.None; // default value

      const assetShares = bank.totalAssetShares;
      const liabilityShares = bank.totalLiabilityShares;

      // Validate retrieved values
      if (
        !assetShares ||
        !liabilityShares ||
        !marginRequirementType ||
        !priceBias
      ) {
        console.log(
          `Bank => ${bankAddr}\n  ❌ Missing required data for asset/liability computations => Skipping.\n`
        );
        continue;
      }

      // Compute Assets and Liabilities
      const assets = bank.computeAssetUsdValue(
        oraclePrice,
        assetShares,
        marginRequirementType,
        priceBias
      );
      const liabilities = bank.computeLiabilityUsdValue(
        oraclePrice,
        liabilityShares,
        marginRequirementType,
        priceBias
      );

      totalAssetsAllBanks = totalAssetsAllBanks.plus(assets);
      totalLiabilitiesAllBanks = totalLiabilitiesAllBanks.plus(liabilities);
      includedCount++;

      // Compute interest rates & utilization
      const { lendingRate, borrowingRate } = bank.computeInterestRates();
      const utilization = bank.computeUtilizationRate().multipliedBy(100);

      console.log("===== Bank Report =====");
      console.log(`Address => ${bankAddr}`);
      console.log(`Token Symbol => ${tokenSymbol || "N/A"}`);
      console.log(`Mint => ${mint}`);
      console.log(`State => ${bank.config.operationalState}`);
      console.log(`TVL => $${tvl.toFixed(2)}`);
      console.log(`Assets => $${assets.toFixed(2)}`);
      console.log(`Liabilities => $${liabilities.toFixed(2)}`);
      console.log(`Utilization => ${utilization.toFixed(2)}%`);
      console.log(`Lending APY => ${lendingRate.toFixed(2)}%`);
      console.log(`Borrowing APY => ${borrowingRate.toFixed(2)}%`);
      console.log("--------------------------------------------\n");

      // Optional: Collect report data
      reports.push({
        address: bankAddr,
        tokenSymbol: tokenSymbol || "N/A",
        mint: mint,
        state: bank.config.operationalState.toString(),
        tvl: `$${tvl.toFixed(2)}`,
        assets: `$${assets.toFixed(2)}`,
        liabilities: `$${liabilities.toFixed(2)}`,
        utilization: `${utilization.toFixed(2)}%`,
        lendingAPY: `${lendingRate.toFixed(2)}%`,
        borrowingAPY: `${borrowingRate.toFixed(2)}%`,
      });
    }

    // Optional: Export reports to JSON or CSV
    // Uncomment the following lines to export the reports
    /*
    import fs from 'fs';
    fs.writeFileSync('marginfi_reports.json', JSON.stringify(reports, null, 2));
    */

    // 9) Final summary
    console.log("===========================================");
    console.log(`"Operational" Banks => ${bankArray.length}`);
    console.log(`Banks with oracle => ${includedCount}`);
    console.log(`Total TVL (included) => $${totalTvlAllBanks.toFixed(2)}`);
    console.log(`Total Assets (included) => $${totalAssetsAllBanks.toFixed(2)}`);
    console.log(`Total Liabilities (included) => $${totalLiabilitiesAllBanks.toFixed(2)}`);
    console.log("===========================================\n");
  } catch (error) {
    console.error("An unexpected error occurred:", error);
    process.exit(1);
  }
}

// Run if called directly => "npx ts-node marginfiMacroAggregator.ts"
if (require.main === module) {
  main().catch((err) => {
    console.error("Fatal error =>", err);
    process.exit(1);
  });
}