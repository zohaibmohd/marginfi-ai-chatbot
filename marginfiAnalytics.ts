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

import { AccountType } from "@mrgnlabs/marginfi-client-v2";
import { getMarginfiClient } from "./utils";

export async function gatherBankAnalytics(): Promise<Array<Record<string, any>>> {
  try {
    const client = await getMarginfiClient();
    const bankKeys = await client.getAllProgramAccountAddresses(AccountType.Bank);
    console.log(`Found ${bankKeys.length} banks.`);

    const results: Array<Record<string, any>> = [];

    for (const pubkey of bankKeys) {
      const accountInfo = await client.connection.getAccountInfo(pubkey);
      if (!accountInfo) {
        console.warn(`No account info for bank: ${pubkey.toBase58()}`);
        continue;
      }

      const bank = client.getBankByPk(pubkey);
      if (!bank) {
        console.warn(`Could not decode bank: ${pubkey.toBase58()}`);
        continue;
      }

      const { lendingRate, borrowingRate } = bank.computeInterestRates();
      const utilization = bank.computeUtilizationRate();

      results.push({
        address: pubkey.toBase58(),
        mint: bank.mint.toBase58(),
        lendingRate: lendingRate.toNumber(),
        borrowingRate: borrowingRate.toNumber(),
        utilization: utilization.toNumber()
      });
    }

    return results;
  } catch (error) {
    console.error("Error gathering bank analytics:", error);
    throw error;
  }
}