"use strict";
// backend/src/marginfiMacroAggregator.ts
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMarginFiReports = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const marginfi_client_v2_1 = require("@mrgnlabs/marginfi-client-v2");
const mrgn_common_1 = require("@mrgnlabs/mrgn-common");
const web3_js_1 = require("@solana/web3.js");
/**
 * Maps RiskTier to MarginRequirementType.
 * Adjust the mapping based on your SDK's definitions.
 */
const mapRiskTierToMarginRequirementType = (riskTier) => {
    switch (riskTier) {
        case marginfi_client_v2_1.RiskTier.Collateral:
            return marginfi_client_v2_1.MarginRequirementType.Equity;
        // Add additional mappings if there are more RiskTiers
        default:
            return marginfi_client_v2_1.MarginRequirementType.Equity; // Default to Equity if undefined
    }
};
/**
 * Fetches and aggregates MarginFi bank data.
 * @returns An array of BankReport objects containing structured bank data.
 */
const getMarginFiReports = () => __awaiter(void 0, void 0, void 0, function* () {
    // Validate essential environment variables
    if (!process.env.MY_MAINNET_URL) {
        throw new Error('Environment variable MY_MAINNET_URL is not set.');
    }
    if (!process.env.OPENAI_API_KEY) {
        throw new Error('Environment variable OPENAI_API_KEY is not set.');
    }
    const marginfiConfig = (0, marginfi_client_v2_1.getConfig)("production");
    const dummyKeypair = web3_js_1.Keypair.generate();
    const dummyWallet = new mrgn_common_1.NodeWallet(dummyKeypair);
    const connection = new web3_js_1.Connection(process.env.MY_MAINNET_URL, 'confirmed');
    const client = yield marginfi_client_v2_1.MarginfiClient.fetch(marginfiConfig, dummyWallet, connection);
    const bankArray = Array.from(client.banks.values());
    const reports = [];
    for (const bank of bankArray) {
        const bankAddr = bank.address.toBase58();
        const mint = bank.mint.toBase58();
        const tokenSymbol = bank.tokenSymbol;
        const oraclePrice = client.getOraclePriceByBank(bankAddr);
        if (!oraclePrice) {
            console.log(`Bank => ${bankAddr}\n  ❌ Missing oracle => Skipping calculations.\n`);
            continue;
        }
        // Compute total TVL (assets + liabilities)
        const tvl = bank.computeTvl(oraclePrice);
        const assetShares = bank.totalAssetShares;
        const liabilityShares = bank.totalLiabilityShares;
        // Attempt to access 'riskTier' from 'bank.config'
        const riskTier = bank.config.riskTier;
        const marginRequirementType = riskTier
            ? mapRiskTierToMarginRequirementType(riskTier)
            : marginfi_client_v2_1.MarginRequirementType.Equity; // default value
        const priceBias = marginfi_client_v2_1.PriceBias.None; // default value
        const assets = bank.computeAssetUsdValue(oraclePrice, assetShares, marginRequirementType, priceBias);
        const liabilities = bank.computeLiabilityUsdValue(oraclePrice, liabilityShares, marginRequirementType, priceBias);
        const { lendingRate, borrowingRate } = bank.computeInterestRates();
        const utilization = bank.computeUtilizationRate().multipliedBy(100);
        const report = {
            address: bankAddr,
            tokenSymbol: tokenSymbol || "N/A",
            mint: mint,
            state: bank.config.operationalState.toString(),
            tvl: `$${tvl.toFixed(2)}`,
            assets: `$${assets.toFixed(2)}`,
            liabilities: `$${liabilities.toFixed(2)}`,
            utilization: `${utilization.toFixed(2)}%`,
            lendingAPY: `${lendingRate.toFixed(2)}%`,
            borrowingAPY: `${borrowingRate.toFixed(2)}%`,
        };
        reports.push(report);
    }
    return reports;
});
exports.getMarginFiReports = getMarginFiReports;
// If this script is run directly, execute the function and log the results
if (require.main === module) {
    (0, exports.getMarginFiReports)()
        .then(reports => {
        console.log(JSON.stringify(reports, null, 2));
    })
        .catch(error => {
        console.error('Error fetching MarginFi reports:', error);
        process.exit(1);
    });
}
