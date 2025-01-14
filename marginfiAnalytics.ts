import { Connection } from "@solana/web3.js";
import {
  MarginfiClient,
  getConfig,
  Bank,
  AccountType,
  MARGINFI_IDL,
} from "@mrgnlabs/marginfi-client-v2";
import { NodeWallet } from "@mrgnlabs/mrgn-common";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

/**
 * Known mint addresses for valid banks
 */
const knownMints = new Set([
  "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn", // JitoSOL
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
  "So11111111111111111111111111111111111111112",  // SOL
  "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", // USDT
  // Add more mints as needed...
]);

/**
 * Initialize Marginfi in dev or production mode.
 */
async function initializeMarginfi(): Promise<{
  client: MarginfiClient;
  connection: Connection;
}> {
  const rpcUrl = process.env.RPC_URL_DEV;
  if (!rpcUrl) throw new Error("Missing RPC_URL_DEV in .env");

  const privateKeyPath = process.env.SOLANA_PRIVATE_KEY_PATH || "keypair.json";
  const keypair = JSON.parse(fs.readFileSync(privateKeyPath, "utf-8"));
  const wallet = new NodeWallet(keypair);

  const connection = new Connection(rpcUrl, "confirmed");
  const config = getConfig("dev"); // Use "production" for mainnet
  const client = await MarginfiClient.fetch(config, wallet, connection);
  console.log(`🚀 Marginfi Client Initialized with wallet: ${client.wallet.publicKey.toBase58()}`);
  return { client, connection };
}

/**
 * Gathers analytics from all Marginfi "Bank" accounts on-chain, filtered by mint addresses.
 */
export async function gatherBankAnalytics(): Promise<Array<Record<string, any>>> {
  const { client, connection } = await initializeMarginfi();
  const bankKeys = await client.getAllProgramAccountAddresses(AccountType.Bank);

  console.log(`Found ${bankKeys.length} banks.`);
  const results: Array<Record<string, any>> = [];

  for (const pubkey of bankKeys) {
    const accountInfo = await connection.getAccountInfo(pubkey);
    if (!accountInfo || !accountInfo.data) {
      console.warn(`Invalid account: ${pubkey.toBase58()}`);
      continue;
    }

    try {
      const feedIdMap = new Map(); // Placeholder, adjust as needed
      const bank = Bank.fromBuffer(pubkey, accountInfo.data, MARGINFI_IDL as any, feedIdMap);

      // Filter banks by known mint addresses
      const mintAddress = bank.mint.toBase58();
      if (!knownMints.has(mintAddress)) {
        console.warn(`Skipping unknown mint: ${mintAddress} for bank ${pubkey.toBase58()}`);
        continue;
      }

      console.log(`Processing bank ${pubkey.toBase58()} with mint ${mintAddress}`);

      results.push({
        address: pubkey.toBase58(),
        mint: mintAddress,
        totalAssetShares: bank.totalAssetShares.toString(),
        totalLiabilityShares: bank.totalLiabilityShares.toString(),
        interestRates: {
          depositRate: bank.computeInterestRates().lendingRate.toNumber(),
          borrowRate: bank.computeInterestRates().borrowingRate.toNumber(),
        },
        utilizationRate: bank.computeUtilizationRate().toNumber(),
      });
    } catch (err) {
      console.error(`Error decoding bank ${pubkey.toBase58()}:`, err);
    }
  }

  console.log(`✅ Gathered metrics on ${results.length} banks total.`);
  return results;
}