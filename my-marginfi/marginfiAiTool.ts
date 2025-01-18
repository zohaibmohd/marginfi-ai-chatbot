/**
 * marginfiAiTool.ts
 *
 * Purpose:
 *   - Provide aggregator methods for the AI
 *   - Integrates Helius for historical data in getHistoricalRates
 *   - getNetApy with partial real logic
 *   - The rest remain stubs or partial stubs
 */

import { z } from "zod";
import BigNumber from "bignumber.js";
import "dotenv/config";
import fetch, { Response } from "node-fetch";

import { getMarginfiClientCached } from "./marginfiClient";
import { getSymbolForMint } from "./tokenRegistry";

// Import real Bank & OraclePrice from marginfi-client-v2
import type { Bank as MrgnBank, OraclePrice as MrgnOraclePrice } from "@mrgnlabs/marginfi-client-v2";

/**
 * We'll alias Bank to the real MrgnBank for consistent usage.
 * OraclePrice from marginfi is typically BigNumber, or possibly null.
 */
export type Bank = MrgnBank;
export type OraclePrice = MrgnOraclePrice; // usually BigNumber

/**
 * computeVolatility => standard deviation of a numeric array
 */
function computeVolatility(rates: number[]): number {
  if (rates.length < 2) return 0;
  const mean = rates.reduce((a, b) => a + b, 0) / rates.length;
  const variance = rates
    .map((r) => (r - mean) ** 2)
    .reduce((acc, v) => acc + v, 0) / rates.length;
  return Math.sqrt(variance);
}

/* -----------------------------------------------------------------------
 * 1) getTopBanks
 * ----------------------------------------------------------------------- */
export const topBanksSchema = z.object({
  by: z
    .enum([
      "lendingRate",
      "borrowRate",
      "tvl",
      "utilization",
      "emissions",
      "insuranceFeeFixedApr",
      "protocolFixedFeeApr",
    ])
    .default("lendingRate"),
  limit: z.number().default(5),
});
export type TopBanksArgs = z.infer<typeof topBanksSchema>;

export async function getTopBanks(args: TopBanksArgs) {
  const client = await getMarginfiClientCached();

  function rankFn(addr: string): number {
    const bank = client.banks.get(addr)!;
    switch (args.by) {
      case "lendingRate":
        return bank.computeInterestRates().lendingRate.toNumber();
      case "borrowRate":
        return bank.computeInterestRates().borrowingRate.toNumber();
      case "tvl": {
        const op = client.getOraclePriceByBank(addr);
        // if null, skip
        if (!op) return 0;
        return bank.computeTvl(op).toNumber();
      }
      case "utilization":
        return bank.computeUtilizationRate().toNumber();
      case "emissions":
        return bank.emissionsRate || 0;
      case "insuranceFeeFixedApr":
        return bank.config.interestRateConfig.insuranceFeeFixedApr?.toNumber() || 0;
      case "protocolFixedFeeApr":
        return bank.config.interestRateConfig.protocolFixedFeeApr?.toNumber() || 0;
    }
  }

  const scored: Array<{ address: string; score: number }> = [];
  for (const [addr] of client.banks.entries()) {
    try {
      const val = rankFn(addr) ?? 0;
      scored.push({ address: addr, score: val });
    } catch {
      // skip
    }
  }
  scored.sort((a, b) => b.score - a.score);

  const top = scored.slice(0, args.limit).map((item) => {
    const bank = client.banks.get(item.address)!;
    const mintStr = bank.mint.toBase58();
    const symbol = getSymbolForMint(mintStr);
    return {
      address: item.address,
      symbol,
      score: item.score.toFixed(2),
    };
  });

  return {
    by: args.by,
    limit: args.limit,
    topBanks: top,
  };
}

/* -----------------------------------------------------------------------
 * 2) getTotalTvl
 * ----------------------------------------------------------------------- */
export const totalTvlSchema = z.object({});
export type TotalTvlArgs = z.infer<typeof totalTvlSchema>;

export async function getTotalTvl(_args: TotalTvlArgs) {
  const client = await getMarginfiClientCached();

  let totalNumeric = new BigNumber(0);
  for (const [addr, bank] of client.banks.entries()) {
    const oraclePrice = client.getOraclePriceByBank(addr);
    if (!oraclePrice) continue;
    totalNumeric = totalNumeric.plus(bank.computeTvl(oraclePrice));
  }

  return {
    bankCount: client.banks.size,
    totalTvl: totalNumeric.toFixed(2),
  };
}

/* -----------------------------------------------------------------------
 * 3) getBankDetail
 * ----------------------------------------------------------------------- */
export const bankDetailSchema = z.object({
  mint: z.string().min(32, "Must be a base58 mint address"),
});
export type BankDetailArgs = z.infer<typeof bankDetailSchema>;

export async function getBankDetail(args: BankDetailArgs) {
  const client = await getMarginfiClientCached();

  let foundBankAddr: string | undefined;
  for (const [addr, bank] of client.banks.entries()) {
    if (bank.mint.toBase58() === args.mint) {
      foundBankAddr = addr;
      break;
    }
  }
  if (!foundBankAddr) {
    return { error: `No bank found for mint => ${args.mint}` };
  }

  const bank = client.banks.get(foundBankAddr)!;
  const symbol = getSymbolForMint(args.mint) || "Unknown";
  const { lendingRate, borrowingRate } = bank.computeInterestRates();
  const utilization = bank.computeUtilizationRate();

  let tvlStr = "0";
  const rawOracle = client.getOraclePriceByBank(foundBankAddr);
  if (rawOracle) {
    tvlStr = bank.computeTvl(rawOracle).toFixed(2);
  }

  // if rawOracle is null => 0
  const numericPrice = rawOracle instanceof BigNumber ? rawOracle.toNumber() : 0;
  const oraclePriceStr = numericPrice !== 0 ? numericPrice.toFixed(6) : "N/A";

  return {
    mint: args.mint,
    symbol,
    bankAddress: foundBankAddr,
    lendingRate: lendingRate.toFixed(2),
    borrowingRate: borrowingRate.toFixed(2),
    utilization: utilization.toFixed(2),
    tvl: tvlStr,
    oraclePrice: oraclePriceStr,
  };
}

/* -----------------------------------------------------------------------
 * 4) getHistoricalRates
 * ----------------------------------------------------------------------- */
export const historicalRatesSchema = z.object({
  mint: z.string().min(32),
  timeframe: z.enum(["1d", "7d", "30d"]).default("7d"),
});
export type HistoricalRatesArgs = z.infer<typeof historicalRatesSchema>;

async function fetchRealHistoricalRates(
  mint: string,
  timeframe: string
): Promise<Array<{ day: string; lendingRate: number; borrowingRate: number }>> {
  const client = await getMarginfiClientCached();

  let foundBank: Bank | undefined;
  for (const [_, bankObj] of client.banks.entries()) {
    if (bankObj.mint.toBase58() === mint) {
      foundBank = bankObj;
      break;
    }
  }
  if (!foundBank) {
    throw new Error(`Bank not found for mint: ${mint}`);
  }

  const bankAddress = foundBank.address.toBase58();
  const { startDate, endDate } = calculateTimeRange(timeframe);
  const heliusApiKey = process.env.HELIUS_API_KEY;

  if (!heliusApiKey) {
    throw new Error("No Helius API key found in environment!");
  }

  const allHistoricalData: Array<{
    timestamp: number;
    lendingRate: number;
    borrowingRate: number;
  }> = [];
  let before: string | null = null;

  while (true) {
    const url: string = `https://api.helius.xyz/v0/addresses/${bankAddress}/transactions?api-key=${heliusApiKey}${
      before ? `&before=${before}` : ""
    }`;

    let data: any;
    try {
      const resp: Response = await fetch(url);
      if (!resp.ok) {
        const errorTxt = await resp.text();
        if (resp.status === 404) {
          throw new Error(
            `Historical rates not found for mint ${mint} - 404 from Helius`
          );
        }
        throw new Error(`Helius fetch error => ${resp.status}: ${errorTxt}`);
      }
      data = await resp.json();
      if (!Array.isArray(data)) {
        console.warn(`Helius returned a non-array => ${JSON.stringify(data)}`);
        break;
      }
    } catch (err) {
      console.error("Helius fetch error =>", err);
      break;
    }

    const filtered = extractRatesFromTransactions(data, startDate, endDate);
    allHistoricalData.push(...filtered);

    if (data.length < 100) {
      break;
    }
    before = data[data.length - 1].signature as string;
  }

  return allHistoricalData.map((item) => ({
    day: formatDate(item.timestamp),
    lendingRate: item.lendingRate,
    borrowingRate: item.borrowingRate,
  }));
}

function extractRatesFromTransactions(
  transactions: any[],
  startDate: Date,
  endDate: Date
): Array<{ timestamp: number; lendingRate: number; borrowingRate: number }> {
  const rateUpdates: Array<{ timestamp: number; lendingRate: number; borrowingRate: number }> = [];

  for (const tx of transactions) {
    if (!tx || typeof tx.timestamp !== "number") continue;
    const txTime = new Date(tx.timestamp * 1000);
    if (txTime < startDate || txTime > endDate) continue;
    if (!tx.events || !Array.isArray(tx.events)) continue;

    const { lendingRate, borrowingRate } = parseRates(tx.events);
    if (lendingRate !== null && borrowingRate !== null) {
      rateUpdates.push({
        timestamp: tx.timestamp,
        lendingRate,
        borrowingRate,
      });
    }
  }
  return rateUpdates;
}

function parseRates(events: any) {
  let lendingRate: number | null = null;
  let borrowingRate: number | null = null;

  for (const e of events) {
    if (e.type === "UPDATE_INTEREST_PERPETUAL_MARKET") {
      lendingRate = parseFloat(e.lendingRate ?? "0");
      borrowingRate = parseFloat(e.borrowingRate ?? "0");
      break;
    }
  }
  return { lendingRate, borrowingRate };
}

function calculateTimeRange(tf: string): { startDate: Date; endDate: Date } {
  const now = new Date();
  const startDate = new Date(now);
  switch (tf) {
    case "1d":
      startDate.setDate(now.getDate() - 1);
      break;
    case "7d":
      startDate.setDate(now.getDate() - 7);
      break;
    case "30d":
      startDate.setDate(now.getDate() - 30);
      break;
    default:
      throw new Error(`Invalid timeframe => ${tf}`);
  }
  return { startDate, endDate: now };
}

function formatDate(ts: number) {
  const dateObj = new Date(ts * 1000);
  return dateObj.toISOString().slice(0, 10);
}

export async function getHistoricalRates(args: HistoricalRatesArgs) {
  let data: Array<{ day: string; lendingRate: number; borrowingRate: number }>;
  try {
    data = await fetchRealHistoricalRates(args.mint, args.timeframe);
  } catch (err) {
    return { error: `Failed to fetch real historical rates => ${String(err)}` };
  }

  let volatility = "N/A";
  if (data.length > 1) {
    const stdev = computeVolatility(data.map((d) => d.lendingRate));
    volatility = `${stdev.toFixed(2)}%`;
  }
  return {
    mint: args.mint,
    timeframe: args.timeframe,
    historicalData: data,
    volatility,
  };
}

/* -----------------------------------------------------------------------
 * 4a) getVolatility => partial stub
 * ----------------------------------------------------------------------- */
export async function getVolatility(mint: string) {
  console.log("[Stub Notice] getVolatility => returning placeholder 3.14%");
  return { mint, volatility: "3.14%" };
}

/* -----------------------------------------------------------------------
 * 5) getNetApy => partial real approach with fees/incentives
 * ----------------------------------------------------------------------- */
export const netApySchema = z.object({
  mint: z.string().min(32),
});
export type NetApyArgs = z.infer<typeof netApySchema>;

async function computeRealNetApy(bankAddress: string) {
  const client = await getMarginfiClientCached();
  const bank = client.banks.get(bankAddress);
  if (!bank) {
    throw new Error(`Bank not found => ${bankAddress}`);
  }

  const { lendingRate, borrowingRate } = bank.computeInterestRates();
  const protocolFeeApr = bank.config.interestRateConfig.protocolFixedFeeApr?.toNumber() || 0;

  let insuranceFee = 0;
  try {
    insuranceFee = await fetchInsuranceFeeFromAPI(bankAddress);
  } catch (error) {
    console.warn("Error fetching insurance fees:", error);
  }

  let incentives = 0;
  try {
    incentives = await fetchIncentivesFromAPI(bankAddress);
  } catch (error) {
    console.warn("Error fetching incentives:", error);
  }

  const netLending = lendingRate.toNumber() - protocolFeeApr - insuranceFee + incentives;
  const netBorrowing = borrowingRate.toNumber() + protocolFeeApr + insuranceFee - incentives;

  return { netLending, netBorrowing };
}

async function fetchInsuranceFeeFromAPI(_bankAddr: string) {
  return 0;
}
async function fetchIncentivesFromAPI(_bankAddr: string) {
  return 0;
}

export async function getNetApy(args: NetApyArgs) {
  const client = await getMarginfiClientCached();

  let foundAddr: string | undefined;
  for (const [addr, bank] of client.banks.entries()) {
    if (bank.mint.toBase58() === args.mint) {
      foundAddr = addr;
      break;
    }
  }
  if (!foundAddr) {
    return { error: `No bank found for mint => ${args.mint}` };
  }

  let netVals;
  try {
    netVals = await computeRealNetApy(foundAddr);
  } catch (err) {
    return { error: `Failed to compute net APY => ${String(err)}` };
  }

  return {
    mint: args.mint,
    grossLendingApy: "5.00%",
    netLendingApy: `${netVals.netLending.toFixed(2)}%`,
    grossBorrowingApy: "9.00%",
    netBorrowingApy: `${netVals.netBorrowing.toFixed(2)}%`,
  };
}

/* -----------------------------------------------------------------------
 * 6) getLiquidations => partial stub
 * ----------------------------------------------------------------------- */
export const getLiquidationsSchema = z.object({
  limit: z.number().default(5),
});
export type GetLiquidationsArgs = z.infer<typeof getLiquidationsSchema>;

export async function getLiquidations(args: GetLiquidationsArgs) {
  console.log("[Stub Notice] getLiquidations => returning static events!");
  return {
    limit: args.limit,
    events: [
      {
        accountId: "AccountXYZ123",
        collateralMint: "So11111111111111111111111111111111111111112",
        debtMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        liquidationPrice: "1.02",
      },
      {
        accountId: "AccountABC789",
        collateralMint: "BTCsol11111111111111111111111111111111111",
        debtMint: "So11111111111111111111111111111111111111112",
        liquidationPrice: "15340.00",
      },
    ],
  };
}

/* -----------------------------------------------------------------------
 * 7) getAccountBalanceSummary => partial stub
 * ----------------------------------------------------------------------- */
export const getAccountBalanceSummarySchema = z.object({
  accountId: z.string().min(3),
});
export type GetAccountBalanceSummaryArgs = z.infer<typeof getAccountBalanceSummarySchema>;

export async function getAccountBalanceSummary(args: GetAccountBalanceSummaryArgs) {
  console.log("[Stub Notice] getAccountBalanceSummary => returning static positions!");
  return {
    accountId: args.accountId,
    positions: [
      {
        mint: "So11111111111111111111111111111111111111112",
        symbol: "SOL",
        balance: "12.3",
        valueUSD: "256.00",
      },
      {
        mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        symbol: "USDC",
        balance: "1500",
        valueUSD: "1500.00",
      },
    ],
    totalValueUSD: "1756.00",
    netLeverage: "1.2x",
    liquidationThreshold: "2.0x",
  };
}

/* -----------------------------------------------------------------------
 * 8) getTopBanksByEmissions => partial stub
 * ----------------------------------------------------------------------- */
export const topBanksByEmissionsSchema = z.object({
  limit: z.number().default(5),
  type: z.enum(["lending", "borrowing"]).default("lending"),
});
export type TopBanksByEmissionsArgs = z.infer<typeof topBanksByEmissionsSchema>;

export async function getTopBanksByEmissions(args: TopBanksByEmissionsArgs) {
  console.log("[Stub Notice] getTopBanksByEmissions => partial aggregator for emissions!");
  const client = await getMarginfiClientCached();

  const scored: Array<{ address: string; emissions: number }> = [];
  for (const [addr, bank] of client.banks.entries()) {
    const metric =
      args.type === "lending" ? bank.emissionsRate || 0 : (bank.emissionsRate || 0) / 2;
    scored.push({ address: addr, emissions: metric });
  }

  scored.sort((a, b) => b.emissions - a.emissions);

  const top = scored.slice(0, args.limit).map((item) => {
    const bank = client.banks.get(item.address)!;
    const mintStr = bank.mint.toBase58();
    const symbol = getSymbolForMint(mintStr);
    return {
      address: item.address,
      symbol,
      emissions: item.emissions.toFixed(2),
    };
  });

  return {
    type: args.type,
    limit: args.limit,
    top,
  };
}

/* -----------------------------------------------------------------------
 * 9) getBestLoopingOpportunity => partial stub
 * ----------------------------------------------------------------------- */
export const bestLoopingOpportunitySchema = z.object({});
export type BestLoopingOpportunityArgs = z.infer<typeof bestLoopingOpportunitySchema>;

export async function getBestLoopingOpportunity(_args: BestLoopingOpportunityArgs) {
  console.log("[Stub Notice] getBestLoopingOpportunity => returning static deposit/borrow info!");
  return {
    depositMint: "So11111111111111111111111111111111111111112",
    borrowMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    depositApy: "5.3%",
    borrowApy: "2.7%",
    netApyWithLeverage: "10.1%",
    recommendedLeverage: "3.0x",
  };
}

/* -----------------------------------------------------------------------
 * 10) getFilteredBanks => partial aggregator
 * ----------------------------------------------------------------------- */
export const filteredBanksSchema = z.object({
  utilizationMin: z.number().optional(),
  utilizationMax: z.number().optional(),
  excludeMints: z.array(z.string()).default([]),
});
export type FilteredBanksArgs = z.infer<typeof filteredBanksSchema>;

export async function getFilteredBanks(args: FilteredBanksArgs) {
  const client = await getMarginfiClientCached();

  const results: Array<{
    address: string;
    mint: string;
    symbol: string;
    utilization: number;
  }> = [];

  for (const [addr, bank] of client.banks.entries()) {
    const mintStr = bank.mint.toBase58();
    if (args.excludeMints.includes(mintStr)) {
      continue;
    }

    const utilNum = bank.computeUtilizationRate().toNumber();
    if (args.utilizationMin !== undefined && utilNum < args.utilizationMin) {
      continue;
    }
    if (args.utilizationMax !== undefined && utilNum > args.utilizationMax) {
      continue;
    }

    results.push({
      address: addr,
      mint: mintStr,
      symbol: getSymbolForMint(mintStr),
      utilization: utilNum,
    });
  }

  return {
    filters: args,
    count: results.length,
    banks: results,
  };
}