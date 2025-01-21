// backend/src/marginfiMacroAggregator.ts

import dotenv from 'dotenv';
dotenv.config();

import {
  MarginfiClient,
  getConfig,
  MarginRequirementType,
  PriceBias,
  RiskTier
} from '@mrgnlabs/marginfi-client-v2';
import { NodeWallet } from '@mrgnlabs/mrgn-common';
import { Connection, Keypair } from '@solana/web3.js';

/**
 * Represents the data for each MarginFi bank.
 */
export interface BankReport {
  address: string;         // Bank public key
  tokenSymbol: string;     // e.g. "USDC" or "SOL"
  mint: string;            // Mint public key
  state: string;           // e.g. "Operational" or "ReduceOnly"
  assets: string;          // e.g. "$123.45"
  liabilities: string;     // e.g. "$67.89"
  utilization: string;     // e.g. "45.00%"
  lendingAPY: string;      // e.g. "4%" or "7%"
  borrowingAPY: string;    // e.g. "6%" or "10%"
  riskTier?: string;       // e.g. "Collateral" or "Unknown"
  operationalState?: string;
}

/**
 * Convert a RiskTier to its corresponding MarginRequirementType.
 */
function mapRiskTierToMarginRequirementType(riskTier: RiskTier): MarginRequirementType {
  switch (riskTier) {
    case RiskTier.Collateral:
      return MarginRequirementType.Equity;
    default:
      // If undefined or unknown, default to Equity
      return MarginRequirementType.Equity;
  }
}

// Simple aggregator cache
let cachedReports: BankReport[] | null = null;
let lastFetchTime = 0;
const CACHE_DURATION_MS = 60_000; // 1 minute

/**
 * Fetch & parse MarginFi bank data from mainnet, returning an array of BankReport.
 * Caches results for 60 seconds.
 *
 * NOTE: We are no longer skipping banks with missing oracles or zero assets/liabilities,
 * so that all banks are visible in aggregator results.
 */
export async function getMarginFiReports(): Promise<BankReport[]> {
  console.log('[Aggregator Debug] Entering getMarginFiReports()...');

  try {
    const now = Date.now();
    // If still fresh, reuse cached data
    if (cachedReports && now - lastFetchTime < CACHE_DURATION_MS) {
      console.log('[Aggregator Debug] Using cached MarginFi reports.');
      return cachedReports;
    }

    // Check required env vars
    if (!process.env.MY_MAINNET_URL) {
      throw new Error('Environment variable MY_MAINNET_URL is not set.');
    }
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('Environment variable OPENAI_API_KEY is not set.');
    }

    console.log('[Aggregator Debug] Using mainnet RPC:', process.env.MY_MAINNET_URL);

    const marginfiConfig = getConfig('production');
    console.log('[Aggregator Debug] Using MarginFi config (production).');

    const connection = new Connection(process.env.MY_MAINNET_URL, 'confirmed');
    const dummyKeypair = Keypair.generate();
    const dummyWallet = new NodeWallet(dummyKeypair);

    console.log('[Aggregator Debug] Fetching MarginfiClient...');
    const client = await MarginfiClient.fetch(marginfiConfig, dummyWallet, connection);
    console.log('[Aggregator Debug] Fetched MarginfiClient successfully.');

    const bankArray = Array.from(client.banks.values());
    console.log(`[Aggregator Debug] Found ${bankArray.length} total banks in client.banks.`);

    const reports: BankReport[] = [];

    for (const bank of bankArray) {
      const bankAddr = bank.address.toBase58();
      const mint = bank.mint.toBase58();
      const symbol = (bank.tokenSymbol || '').trim();

      console.log(`[Aggregator Debug] Considering bank:
  - Address: ${bankAddr}
  - TokenSymbol: "${symbol}"
  - totalAssetShares: ${bank.totalAssetShares.toString()}
  - totalLiabilityShares: ${bank.totalLiabilityShares.toString()}`);

      // Oracle check (no skip if missing)
      const oraclePrice = client.getOraclePriceByBank(bankAddr);
      if (!oraclePrice) {
        console.log(`[Aggregator Debug] Bank has no oracle => continuing anyway.
           Assets/liabilities may be 0 or inaccurate for this bank.`);
      }

      // If no symbol, label as "Unknown"
      const finalSymbol = symbol || 'Unknown';
      if (!symbol) {
        console.log(`[Aggregator Debug] No token symbol => labeling bank as "Unknown".`);
      }

      // Attempt to read riskTier
      const riskTier = (bank.config as any).riskTier as RiskTier | undefined;
      const riskTierStr = riskTier ? RiskTier[riskTier] : 'Unknown';

      // Convert riskTier => marginRequirementType
      const marginRequirementType = mapRiskTierToMarginRequirementType(
        riskTier || RiskTier.Collateral
      );
      const priceBias = PriceBias.None;

      let computedAssets = 0;
      let computedLiabs = 0;
      let oracleStr = '';

      if (oraclePrice) {
        computedAssets = bank
          .computeAssetUsdValue(
            oraclePrice,
            bank.totalAssetShares,
            marginRequirementType,
            priceBias
          )
          .toNumber();
        computedLiabs = bank
          .computeLiabilityUsdValue(
            oraclePrice,
            bank.totalLiabilityShares,
            marginRequirementType,
            priceBias
          )
          .toNumber();
        oracleStr = oraclePrice.toString();
      } else {
        // Fallback => 0
        computedAssets = 0;
        computedLiabs = 0;
        oracleStr = 'NoOracle';
      }

      console.log(`[Aggregator Debug] Bank: "${finalSymbol}" at ${bankAddr}
  - Oracle price: ${oracleStr}
  - Computed assetsUsd: ${computedAssets}
  - Computed liabsUsd: ${computedLiabs}`);

      // APYs & utilization
      const { lendingRate, borrowingRate } = bank.computeInterestRates();
      const utilizationPct = bank.computeUtilizationRate().multipliedBy(100);

      const operationalState = bank.config.operationalState.toString();

      // Multiply APYs by 100 to convert e.g. 0.07 => "7%"

      const lendingApyPercent = (lendingRate.toNumber() * 100).toFixed(0);
      const borrowingApyPercent = (borrowingRate.toNumber() * 100).toFixed(0);
      
      const report: BankReport = {
        address: bankAddr,
        tokenSymbol: finalSymbol,
        mint,
        state: operationalState,
        assets: formatUsd(computedAssets),
        liabilities: formatUsd(computedLiabs),
        utilization: `${utilizationPct.toFixed(2)}%`,
        lendingAPY: `${lendingApyPercent}%`,
        borrowingAPY: `${borrowingApyPercent}%`,
        riskTier: riskTierStr,
        operationalState,
      };

      console.log(`[Aggregator Debug] => Including bank: "${report.tokenSymbol}"
  Assets: ${report.assets}, Liabilities: ${report.liabilities}
  LendAPY: ${report.lendingAPY}, BorrowAPY: ${report.borrowingAPY}
  RiskTier: ${report.riskTier}, State: ${report.operationalState}`);

      reports.push(report);
    }

    // Cache results
    cachedReports = reports;
    lastFetchTime = now;
    console.log(`[Aggregator Debug] Final count: ${reports.length} banks included. Caching results.`);

    return reports;
  } catch (error) {
    console.error('[Aggregator Debug] Top Level Error in getMarginFiReports:', error);
    // Return empty array on error so the system can handle "No data" gracefully
    return [];
  }
}

/** 
 * Format numeric amounts as USD, e.g. 1234.567 => "$1,234.57"
 */
function formatUsd(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

/** 
 * Provide a bullet-list of **all** banks, with a short UTC timestamp at the top.
 * Called in `chat.ts` if user says "show all banks".
 */
export function getFullAggregatorString(): string {
  if (!cachedReports || cachedReports.length === 0) {
    return 'No data available right now.';
  }
  // short UTC time e.g. "2025-01-21 13:05 UTC"
  const nowStr = getShortUtcTimestamp();
  let out = `As of ${nowStr}, here is a bullet list of all known banks:\n\n`;

  cachedReports.forEach((b) => {
    out += `• ${b.tokenSymbol} (Address: ${b.address})
   - Assets: ${b.assets}
   - Liabilities: ${b.liabilities}
   - Lending APY: ${b.lendingAPY}
   - Borrowing APY: ${b.borrowingAPY}\n\n`;
  });

  return out.trim();
}

/** 
 * Short UTC timestamp, e.g. "2025-01-21 13:05 UTC"
 */
function getShortUtcTimestamp(): string {
  const d = new Date();
  return d.toISOString().slice(0,16).replace('T',' ') + ' UTC';
}

// If run directly => fetch & log
if (require.main === module) {
  (async () => {
    console.log('[Manual Run] aggregator main start...');
    try {
      const data = await getMarginFiReports();
      console.log('[Manual Run] aggregator final data:\n', JSON.stringify(data, null, 2));
      console.log(`[Manual Run] total banks in final data: ${data.length}`);

      // Optionally show full aggregator bullet list
      console.log('\n[Manual Run] Full Aggregator String:\n', getFullAggregatorString());

      console.log('[Manual Run] Done. Exiting now...');
    } catch (err) {
      console.error('[Manual Run] aggregator error:', err);
      process.exit(1);
    }
  })();
}