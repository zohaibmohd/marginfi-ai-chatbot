/***********************************************
 * prefetchMainnet.ts
 *
 * GOAL:
 *   1) Connect to mainnet using your Helius Developer endpoint.
 *   2) Get marginfi mainnet config => (programId, groupPk).
 *   3) Compute the "Bank" discriminator (8 bytes).
 *   4) Filter accounts by:
 *       - offset=0 => bankDisc in base58
 *       - offset=41 => groupPk.toBase58()
 *     so we only get "Bank" accounts from the official marginfi group.
 *   5) For each Bank, store raw base64 data. Optionally parse the bank’s mint
 *      from a known offset if we want (e.g., offset=73..105).
 *   6) Write results to "prefetched_config_mainnet.json" offline usage.
 ***********************************************/

import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import { getConfig } from "@mrgnlabs/marginfi-client-v2";
import { NodeWallet } from "@mrgnlabs/mrgn-common";
import { AnchorProvider } from "@coral-xyz/anchor";
import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes"; // for base58 encoding
import * as crypto from "crypto"; // for hashing
import fs from "fs";             // to write JSON output
import "dotenv/config";          // load environment variables

/** 
 * Minimal structure for each "Bank" we discover.
 * - address: the "Bank" account's address in base58
 * - data: full raw data in base64
 * - mintAddress: optional parse of the bank's mint from known offset
 * - mintRaw: we can fetch the mint's raw data if desired
 */
interface BankRecord {
  address: string;
  data: string;
  mintAddress: string;
  mintRaw?: string;
}

/**
 * We'll write out the final JSON in this structure:
 *   - groupConfig: marginfi program + group pk
 *   - marginfiGroup: store raw group data in base64
 *   - banks: array of the "Bank" records
 */
interface PrefetchedMarginfiData {
  groupConfig: {
    programId: string;
    groupPk: string;
  };
  marginfiGroup: {
    data: string;
  };
  banks: BankRecord[];
}

/**
 * Helper: compute first 8 bytes of sha256("account:Bank"), 
 *  used as the Anchor "discriminator" for the "Bank" struct.
 */
function getBankDiscriminator(): Buffer {
  // e.g. "account:Bank" => sha256 => first 8 bytes
  const hash = crypto.createHash("sha256").update("account:Bank").digest();
  return hash.slice(0, 8);
}

async function main() {
  /************************************************
   * 1) Connect to mainnet via your Helius Developer RPC
   *    This should give up to 50 RPS => fewer errors
   ***********************************************/
  const RPC_URL =
    "https://mainnet.helius-rpc.com/?api-key=f494919d-87b0-4f0d-a8a3-f3c05d5e17ee";
  const connection = new Connection(RPC_URL, "confirmed");
  console.log("Connecting to Marginfi mainnet (Helius) =>", RPC_URL);

  /************************************************
   * 2) Fetch marginfi mainnet config => environment='production'
   *    => returns { programId, groupPk, cluster:'mainnet' }
   ***********************************************/
  const config = getConfig("production");
  console.log("Marginfi mainnet config =>", config);

  /************************************************
   * 3) Fetch the marginfiGroup raw data 
   *    at config.groupPk (the main marginfi group).
   ***********************************************/
  const groupInfo = await connection.getAccountInfo(config.groupPk);
  if (!groupInfo) {
    throw new Error(
      `No group data found at ${config.groupPk.toBase58()}! Possibly uninitialized.`
    );
  }
  console.log(`✅ marginfi group => ${groupInfo.data.length} bytes raw data`);

  /************************************************
   * (Optional) Build an AnchorProvider, but we won't
   * decode each Bank with Anchor. We'll do raw fetch
   * for "Bank" accounts with getProgramAccounts + filters.
   ***********************************************/
  const dummyWallet = new NodeWallet(Keypair.generate());
  const provider = new AnchorProvider(connection, dummyWallet, {});

  /************************************************
   * 4) Compute bankDiscriminator => 8 bytes,
   *    and encode in base58 for the memcmp filter.
   ***********************************************/
  const bankDisc = getBankDiscriminator();
  console.log("Bank disc =>", bankDisc.toString("hex"));

  // base58 encode
  const bankDiscBase58 = bs58.encode(bankDisc);

  /************************************************
   * 5) We'll filter by:
   *    - offset=0 => bankDiscriminator in base58
   *    - offset=41 => groupPk base58
   * so it returns only those "Bank" accounts from this group.
   ***********************************************/
  const filters = [
    {
      memcmp: {
        offset: 0,
        bytes: bankDiscBase58,
      },
    },
    {
      memcmp: {
        offset: 41,
        bytes: config.groupPk.toBase58(),
      },
    },
  ];
  console.log("Applying filters =>", JSON.stringify(filters, null, 2));

  /************************************************
   * 6) get all "Bank" accounts matching marginfi group
   * using your marginfi programId + filters
   ***********************************************/
  const rawBanks = await connection.getProgramAccounts(config.programId, {
    filters,
  });
  console.log(`Found ${rawBanks.length} mainnet "Bank" accounts.`);

  /************************************************
   * 7) For each bank, store its raw data base64,
   *    parse the mint from known offset, if correct.
   ***********************************************/
  const banks: BankRecord[] = [];

  for (const { pubkey, account } of rawBanks) {
    // entire raw data => base64
    const dataB64 = account.data.toString("base64");

    // We'll guess offset=73..(73+32) for the mint, 
    // based on marginfi v2 layout. Adjust if needed.
    let mintAddress = "";
    let mintRaw = "";

    try {
      const MINT_OFFSET = 73;
      const MINT_LEN = 32;
      // slice out the mint bytes
      const mintBytes = account.data.subarray(MINT_OFFSET, MINT_OFFSET + MINT_LEN);
      const mintPk = new PublicKey(mintBytes); // parse as PublicKey
      mintAddress = mintPk.toBase58();

      // Optionally fetch that mint's raw data
      const mintInfo = await connection.getAccountInfo(mintPk);
      if (mintInfo) {
        mintRaw = mintInfo.data.toString("base64");
      }
    } catch (err) {
      console.warn(`Mint parse failed for Bank ${pubkey.toBase58()}`, err);
    }

    // Build our record
    banks.push({
      address: pubkey.toBase58(),
      data: dataB64,
      mintAddress,
      mintRaw,
    });
  }

  /************************************************
   * 8) Build the final JSON object
   ***********************************************/
  const output: PrefetchedMarginfiData = {
    groupConfig: {
      programId: config.programId.toBase58(),
      groupPk: config.groupPk.toBase58(),
    },
    marginfiGroup: {
      data: groupInfo.data.toString("base64"),
    },
    banks,
  };

  /************************************************
   * 9) Write to "prefetched_config_mainnet.json"
   ***********************************************/
  fs.writeFileSync(
    "prefetched_config_mainnet.json",
    JSON.stringify(output, null, 2)
  );
  console.log(`\n✨ Wrote ${banks.length} mainnet banks to prefetched_config_mainnet.json!`);
  console.log("All done using your Helius Developer RPC. Enjoy!");
}

// run the main function & catch errors
main().catch((err) => {
  console.error("PrefetchMainnet error:", err);
  process.exit(1);
});