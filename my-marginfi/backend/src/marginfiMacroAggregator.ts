// backend/src/marginfiMacroAggregator.ts

import dotenv from 'dotenv';
dotenv.config();

import { MarginfiClient, getConfig, MarginRequirementType, PriceBias, RiskTier } from "@mrgnlabs/marginfi-client-v2";
import { NodeWallet } from "@mrgnlabs/mrgn-common";
import { Connection, Keypair } from "@solana/web3.js";
import BigNumber from "bignumber.js";

// Define the structure of a bank report
export interface BankReport {
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

/**
 * Fetches and aggregates MarginFi bank data.
 * @returns An array of BankReport objects containing structured bank data.
 */
export const getMarginFiReports = async (): Promise<BankReport[]> => {
  // Validate essential environment variables
  if (!process.env.MY_MAINNET_URL) {
    throw new Error('Environment variable MY_MAINNET_URL is not set.');
  }
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('Environment variable OPENAI_API_KEY is not set.');
  }

  const marginfiConfig = getConfig("production");
  const dummyKeypair = Keypair.generate();
  const dummyWallet = new NodeWallet(dummyKeypair);
  const connection = new Connection(process.env.MY_MAINNET_URL, 'confirmed');

  const client = await MarginfiClient.fetch(
    marginfiConfig,
    dummyWallet,
    connection
  );

  const bankArray = Array.from(client.banks.values());

  const reports: BankReport[] = [];

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
    const assetShares = bank.totalAssetShares;
    const liabilityShares = bank.totalLiabilityShares;

    // Attempt to access 'riskTier' from 'bank.config'
    const riskTier = (bank.config as any).riskTier as RiskTier | undefined;

    const marginRequirementType = riskTier
      ? mapRiskTierToMarginRequirementType(riskTier)
      : MarginRequirementType.Equity; // default value

    const priceBias = PriceBias.None; // default value

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

    const { lendingRate, borrowingRate } = bank.computeInterestRates();
    const utilization = bank.computeUtilizationRate().multipliedBy(100);

    const report: BankReport = {
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
    };

    reports.push(report);
  }

  return reports;
};

// If this script is run directly, execute the function and log the results
if (require.main === module) {
  getMarginFiReports()
    .then(reports => {
      console.log(JSON.stringify(reports, null, 2));
    })
    .catch(error => {
      console.error('Error fetching MarginFi reports:', error);
      process.exit(1);
    });
}