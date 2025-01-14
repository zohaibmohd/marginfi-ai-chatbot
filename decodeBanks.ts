import "dotenv/config";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { Bank, getConfig, MarginfiClient } from "@mrgnlabs/marginfi-client-v2";
import { NodeWallet } from "@mrgnlabs/mrgn-common";

/************************************************************
 * 1. CONFIG & CONSTANTS
 ************************************************************/
const RPC_URL = process.env.MY_DEVNET_URL || "https://api.devnet.solana.com";

/**
 * Example bank address discovered on Devnet. Replace with whichever
 * is valid for your environment. For instance:
 *  GtV5MNDFnw9oM5zup5vs21tgvzFRzvWe7hbdwUhhDLAT
 */
const BANK_PUBKEY_STR = "GtV5MNDFnw9oM5zup5vs21tgvzFRzvWe7hbdwUhhDLAT";

/**
 * If you have an actual feed ID map, populate this with real values.
 * Example of a valid type: new Map<string, PublicKey>([["someKey", new PublicKey("...")]]);
 */
const feedIdMap: Map<string, PublicKey> = new Map();

/************************************************************
 * 2. MAIN FUNCTION: DECODE A SINGLE MARGINFI BANK
 ************************************************************/
(async () => {
  try {
    // 1) Connect to Solana devnet
    const connection = new Connection(RPC_URL, "confirmed");
    console.log(`🔗 Connected to Devnet: ${RPC_URL}`);

    // 2) Load keypair from .env
    const rawKey = process.env.SOLANA_PRIVATE_KEY_JSON;
    if (!rawKey) {
      throw new Error("❌ Missing SOLANA_PRIVATE_KEY_JSON in .env!");
    }
    const secretKey = new Uint8Array(JSON.parse(rawKey));
    const keypair = Keypair.fromSecretKey(secretKey);

    // 3) Create a NodeWallet
    const wallet = new NodeWallet(keypair);
    console.log(`🔑 Wallet loaded. Public key: ${wallet.publicKey.toBase58()}`);

    // 4) Initialize Marginfi client for Devnet
    const config = getConfig("dev");
    const marginfiClient = await MarginfiClient.fetch(config, wallet, connection);
    console.log("🚀 MarginfiClient initialized on devnet!");

    /**
     * marginfiClient.group is (likely) your MarginfiGroup object
     * needed as the 3rd argument in Bank.fromBuffer. If your library
     * version differs, you may need a different property or method.
     */
    const marginfiGroup = marginfiClient.group;
    if (!marginfiGroup) {
      throw new Error("❌ marginfiClient.group is missing. Check your Marginfi SDK version.");
    }

    // 5) Fetch the raw account data for the chosen bank
    const bankPubkey = new PublicKey(BANK_PUBKEY_STR);
    const accountInfo = await connection.getAccountInfo(bankPubkey);
    if (!accountInfo) {
      throw new Error(`❌ No account info found for bank address: ${BANK_PUBKEY_STR}`);
    }

    // 6) Decode the bank with fromBuffer + marginfiGroup + feedIdMap
    const bank = Bank.fromBuffer(
      bankPubkey,
      accountInfo.data,
      marginfiGroup, // <-- Use the marginfiClient object if that is expected
      feedIdMap
    );
    
    // 7) Retrieve rates & utilization
    const { lendingRate, borrowingRate } = bank.computeInterestRates();
    const utilization = bank.computeUtilizationRate();

    // 8) Print out results
    console.log("✅ Decoded Bank =>", bankPubkey.toBase58());
    console.log("   Mint =>", bank.mint.toBase58());
    console.log("   Lending Rate =>", lendingRate.toNumber());
    console.log("   Borrowing Rate =>", borrowingRate.toNumber());
    console.log("   Utilization =>", utilization.toNumber());

    console.log("\n✨ Decoding complete! Enjoy building on Marginfi. 🚀");
  } catch (err) {
    console.error("❌ Script Error:", err instanceof Error ? err.message : err);
  }
})();