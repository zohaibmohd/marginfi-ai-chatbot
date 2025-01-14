import { Connection, Keypair } from "@solana/web3.js";
import { MarginfiClient, getConfig } from "@mrgnlabs/marginfi-client-v2";
import { NodeWallet } from "@mrgnlabs/mrgn-common";

const SOLANA_PRIVATE_KEY_JSON = process.env.SOLANA_PRIVATE_KEY_JSON;
if (!SOLANA_PRIVATE_KEY_JSON) {
    throw new Error("Missing SOLANA_PRIVATE_KEY_JSON secret!");
}

const privateKeyArray = JSON.parse(SOLANA_PRIVATE_KEY_JSON);
const keypair = Keypair.fromSecretKey(new Uint8Array(privateKeyArray));
const wallet = new NodeWallet(keypair); // Wrap Keypair in NodeWallet

const main = async () => {
    const connection = new Connection("https://api.devnet.solana.com", "confirmed");
    const config = getConfig("dev");
    const client = await MarginfiClient.fetch(config, wallet, connection);

    console.log("🚀 Marginfi Client Initialized:");
    console.log(`Public Key: ${keypair.publicKey.toBase58()}`);
};

main().catch(console.error);