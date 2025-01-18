/******************************************************************
 * marginfiToolkit.ts
 *
 * CLI script providing commands to:
 *   - decode-banks: show interest rates, utilization, etc.
 *   - tvl: sum total value locked across recognized banks
 *
 * By default, uses real-time fetching via getMarginfiClient
 * with your Helius Developer endpoint on mainnet.
 ******************************************************************/

import "dotenv/config";
import BigNumber from "bignumber.js";
import { getMarginfiClient } from "./marginfiClient"; // import your mainnet client builder

/**
 * If you have a custom group address, place it here.
 * Otherwise, the official production group is used by getConfig("production").
 */
const CUSTOM_GROUP_PK = "";

/**
 * decodeBanks:
 * - fetches real-time marginfi data from your Helius plan
 * - prints out each recognized bank's interest rates & utilization
 */
async function decodeBanks() {
  // 1) Build client => real-time fetching
  const client = await getMarginfiClient(CUSTOM_GROUP_PK || undefined);

  console.log("=> Decoding banks. Found client.banks.size =", client.banks.size);

  if (client.banks.size === 0) {
    console.log("No recognized banks in this marginfi group. Exiting.");
    return;
  }

  let decodedCount = 0;

  // 2) For each bank in client.banks, compute interest rates
  for (const [address, bank] of client.banks.entries()) {
    try {
      const { lendingRate, borrowingRate } = bank.computeInterestRates();
      const utilization = bank.computeUtilizationRate();

      decodedCount++;
      console.log(`\nBank => ${address}`);
      console.log(`  Mint =>         ${bank.mint.toBase58()}`);
      console.log(`  Lending Rate => ${lendingRate.toFixed(2)}%`);
      console.log(`  Borrow Rate  => ${borrowingRate.toFixed(2)}%`);
      console.log(`  Utilization =>  ${utilization.toFixed(2)}%`);
    } catch (err) {
      console.warn(`\n[Warning] Error decoding bank ${address}:`, err);
    }
  }

  console.log(`\n✅ decode-banks => Decoded ${decodedCount} recognized banks.\n`);
}

/**
 * computeTvl:
 * - sums bank.computeTvl(oraclePrice) for recognized banks
 */
async function computeTvl() {
  // 1) Build client => real-time fetch
  const client = await getMarginfiClient(CUSTOM_GROUP_PK || undefined);

  console.log("=> Summing TVL. client.banks.size =", client.banks.size);

  let totalTvl = new BigNumber(0);
  let usedCount = 0;

  if (client.banks.size === 0) {
    console.log("No recognized banks in this marginfi group. Exiting.");
    return;
  }

  // 2) For each bank, get oraclePrice & compute Tvl
  for (const [address, bank] of client.banks.entries()) {
    try {
      const oraclePrice = client.getOraclePriceByBank(address);

      if (!oraclePrice) {
        console.warn(`No oracle price for bank ${address}; skipping.`);
        continue;
      }

      const bankTvl = bank.computeTvl(oraclePrice);
      totalTvl = totalTvl.plus(bankTvl);
      usedCount++;

      console.log(`${bank.tokenSymbol || address}: ${bankTvl.toFixed(2)}`);
    } catch (err) {
      console.warn(`Error computing TVL for bank ${address}:`, err);
    }
  }

  console.log(
    `\n✅ computeTvl => Summed from ${usedCount} banks => total: ${totalTvl.toFixed(
      2
    )}\n`
  );
}

/**
 * CLI entrypoint
 *   usage: npx ts-node marginfiToolkit.ts decode-banks
 *          npx ts-node marginfiToolkit.ts tvl
 */
(async function main() {
  const cmd = process.argv[2] || "";

  switch (cmd) {
    case "decode-banks":
      await decodeBanks();
      break;
    case "tvl":
      await computeTvl();
      break;
    default:
      console.log("\nAvailable Commands (Mainnet, real-time via Helius):");
      console.log("  decode-banks  # decode interest rates for recognized banks");
      console.log("  tvl           # sum total TVL for recognized banks with oracles");
      process.exit(0);
  }
})().catch((err) => {
  console.error("❌ Error in marginfiToolkit main:", err);
  process.exit(1);
});