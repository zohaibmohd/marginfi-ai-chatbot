import { Connection } from "@solana/web3.js";
import { MarginfiClient, getConfig, Bank, AccountType } from "@mrgnlabs/marginfi-client-v2";
import dotenv from "dotenv";

dotenv.config();

/**
 * Optional: Known bank references for user-friendly naming
 */
const knownBanks = [
  {
    name: "JitoSol",
    pubkey: "Bohoc1ikHLD7xKJuzTyiTyCwzaL5N7ggJQu75A8mKYM8",
    mint: "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn",
  },
  {
    name: "USDC",
    pubkey: "2s37akK2eyBbp8DZgCm7RtsaEz8eJP3Nxd4urLHQv7yB",
    mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  },
  // ... Add other known banks here
];

/**
 * Initialize Marginfi in dev or production mode.
 */
async function initializeMarginfi(): Promise<{ client: MarginfiClient; connection: Connection }> {
  const rpcUrl = process.env.RPC_URL_DEV;
  if (!rpcUrl) throw new Error("Missing RPC_URL_DEV in .env");

  const connection = new Connection(rpcUrl, "confirmed");
  const config = getConfig("dev"); // Use "production" for mainnet
  const client = await MarginfiClient.fetch(config, null, connection);
  console.log("🚀 Marginfi Client Initialized");

  return { client, connection };
}

/**
 * Gathers analytics from all Marginfi "Bank" accounts on-chain.
 */
export async function gatherBankAnalytics(): Promise<Array<Record<string, any>>> {
  const { client, connection } = await initializeMarginfi();
  const bankKeys = await client.getAllProgramAccountAddresses(AccountType.Bank);
  console.log(`Found ${bankKeys.length} banks.`);

  const results: Array<Record<string, any>> = [];

  for (const pubkey of bankKeys) {
    const accountInfo = await connection.getAccountInfo(pubkey);
    if (!accountInfo) {
      console.warn(`No account info for bank: ${pubkey.toBase58()}`);
      continue;
    }

    try {
      const bank = Bank.fromBuffer(pubkey, accountInfo.data);
      const knownBank = knownBanks.find((kb) => kb.pubkey === pubkey.toBase58());

      const { lendingRate, borrowingRate } = bank.computeInterestRates();
      const utilization = bank.computeUtilizationRate();

      results.push({
        name: knownBank?.name || "Unknown",
        address: pubkey.toBase58(),
        mint: knownBank?.mint || bank.mint.toBase58(),
        decimals: bank.mintDecimals,
        totalAssetShares: bank.totalAssetShares.toString(),
        totalLiabilityShares: bank.totalLiabilityShares.toString(),
        interestRates: {
          depositRate: lendingRate.toNumber(),
          borrowRate: borrowingRate.toNumber(),
        },
        utilizationRate: utilization.toNumber(),
        depositLimit: bank.config.depositLimit?.toString() || "N/A",
        borrowLimit: bank.config.borrowLimit?.toString() || "N/A",
      });
    } catch (err) {
      console.error(`Error decoding bank ${pubkey.toBase58()}`, err);
    }
  }

  console.log(`✅ Gathered metrics on ${results.length} banks total.`);
  return results;
}