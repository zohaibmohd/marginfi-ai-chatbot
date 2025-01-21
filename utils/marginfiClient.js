"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMarginfiClient = void 0;
const web3_js_1 = require("@solana/web3.js");
const marginfi_client_v2_1 = require("@mrgnlabs/marginfi-client-v2");
const mrgn_common_1 = require("@mrgnlabs/mrgn-common");
require("dotenv/config");
/**
 * Utility to initialize and return a MarginfiClient instance.
 */
async function getMarginfiClient() {
    // 1) Use mainnet or devnet from environment
    //    If you want DevNet by default, replace this fallback with "https://api.devnet.solana.com"
    const RPC_URL = process.env.MY_MAINNET_URL || "https://mainnet.helius-rpc.com/?api-key=f494919d-87b0-4f0d-a8a3-f3c05d5e17ee";
    const connection = new web3_js_1.Connection(RPC_URL, "confirmed");
    // 2) Load private key from .env
    const rawKey = process.env.SOLANA_PRIVATE_KEY_JSON;
    if (!rawKey) {
        throw new Error("No SOLANA_PRIVATE_KEY_JSON found in .env!");
    }
    const secretKey = new Uint8Array(JSON.parse(rawKey));
    const wallet = new mrgn_common_1.NodeWallet(web3_js_1.Keypair.fromSecretKey(secretKey));
    // 3) Production config for mainnet
    //    (If you want devnet, do getConfig("dev") instead.)
    const config = (0, marginfi_client_v2_1.getConfig)("production");
    // 4) Initialize the Marginfi client
    return await marginfi_client_v2_1.MarginfiClient.fetch(config, wallet, connection);
}
exports.getMarginfiClient = getMarginfiClient;
