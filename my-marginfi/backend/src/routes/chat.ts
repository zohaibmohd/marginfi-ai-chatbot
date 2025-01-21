// backend/src/routes/chat.ts

import express, { Request, Response } from 'express';
import { 
  getMarginFiReports, 
  getFullAggregatorString, 
  BankReport 
} from '../marginfiMacroAggregator';
import { getOpenAIResponse } from '../services/openAI';

const router = express.Router();

/**
 * A detailed MarginFi overview text, appended if the user requests docs or overview.
 */
const MARGINFI_OVERVIEW = `
# MarginFi Protocol Overview

**Introduction**

MarginFi is a decentralized, open-source protocol built on the Solana blockchain that facilitates overcollateralized lending and borrowing. By harnessing Solana's high-throughput capabilities and low transaction costs, MarginFi provides a highly efficient platform for various decentralized finance (DeFi) activities, including margin trading, yield optimization, and liquidity provisioning, all while maintaining robust security and transparency.

**Core Principles**

*   **Decentralization:** MarginFi operates as a permissionless and transparent protocol, ensuring that no single entity controls the system. Smart contracts govern all interactions, promoting trust and reliability.
*   **Efficiency:** Built on Solana, MarginFi benefits from the blockchain's sub-second transaction finality, minimal fees, and high scalability, making it ideal for high-frequency trading and other real-time applications.
*   **Security:** Overcollateralization of loans is a fundamental principle, guaranteeing the solvency of the platform during market volatility. This protects both lenders and the protocol itself from unforeseen losses.
*   **Transparency:** As an open-source project, all MarginFi’s code is auditable and available for review. On-chain data provides full visibility into the protocol's operation.

**Core Concepts**

1.  **Lending:**
    *   Users can deposit a range of supported crypto assets into MarginFi's lending pools.
    *   These deposits earn interest, which is dynamically adjusted based on the supply and demand for each asset and the associated market conditions.
    *   Lending pools are fully transparent, enabling users to view the total amount of assets and earned interest at any point.
    *   Lenders provide liquidity that enables borrowing within the system.

2.  **Borrowing:**
    *   Borrowing on MarginFi is permissionless and instantaneous. Users can borrow assets to enhance trading strategies, access leveraged positions, or manage their liquidity.
    *   Borrowing requires users to provide collateral, typically in the form of supported crypto assets that exceed the loan value, thereby ensuring overcollateralization of loans.
    *   The interest rates for borrowing also fluctuate dynamically based on supply and demand.

**Key Features**

*   **Decentralized and Open-Source:** MarginFi is a fully decentralized and open-source protocol. Its transparency and community-driven nature enable trust and facilitate collaborative development and improvement.
*   **High-Frequency Trading Ready:**
    *   MarginFi benefits from Solana’s fast transaction finality, allowing high-frequency trading activities to occur seamlessly and reliably.
    *   The low transaction fees on Solana make MarginFi a cost-effective platform for frequent traders.
*   **Ecosystem Integration:**
    *   MarginFi is designed for seamless integration with other Solana-based DeFi protocols, wallets, and applications.
    *   This interoperability enhances composability and network effects across the Solana ecosystem.
*  **Dynamic Interest Rate Model:**
    * MarginFi employs a dynamic interest rate model that adjusts lending and borrowing rates based on real-time utilization and market conditions. This ensures that lenders are compensated fairly for providing liquidity and borrowers have access to competitive rates.
*   **Risk Management:**
    * The use of overcollateralization significantly mitigates risks for both lenders and borrowers, ensuring the safety and stability of the protocol.
    * MarginFi offers mechanisms for liquidation of undercollateralized loans to maintain solvency.
*  **Cross-Margining Capabilities:**
    * MarginFi supports cross-margining, allowing users to leverage a single pool of collateral across multiple positions, enhancing capital efficiency.

**Technology and Architecture**

*   **Smart Contracts:** MarginFi's core logic is implemented using secure and auditable smart contracts on the Solana blockchain.
*   **On-Chain Data:** All critical data related to lending, borrowing, and interest rates is stored transparently on-chain, providing verifiable insights into protocol operations.
*   **Oracles:** MarginFi integrates with reliable oracle services to provide real-time pricing data.

**Potential Use Cases**

*   **Margin Trading:** Leverage assets to amplify gains in trading activities.
*   **Yield Farming:** Deposit assets to earn interest and participate in liquidity mining programs.
*   **Liquidity Provision:** Provide liquidity to the platform and contribute to market efficiency.
*   **Automated Trading:** Build automated strategies that interact with the lending and borrowing functionality.

**Disclaimer**

This overview is provided for informational purposes only and is not investment advice. It should not be construed as a formal guarantee of performance or safety. It is crucial to verify all on-chain data and consult official MarginFi documentation for the most current and accurate details. Risk management and due diligence are strongly encouraged before engaging with any DeFi protocols.

**Conclusion**

MarginFi aims to provide a robust, secure, and efficient platform for decentralized lending and borrowing on the Solana blockchain. The protocol’s design prioritizes transparency, accessibility, and ecosystem integration, making it a powerful tool for various DeFi use cases.
`;

/**
 * conversationCache[sessionId] => [
 *   { role: 'user' | 'assistant', content: string },
 *   ...
 * ]
 */
const conversationCache: Record<string, Array<{ role: 'user' | 'assistant'; content: string }>> = {};

/**
 * In-memory aggregator data + timestamp.
 * If empty or stale, re-fetch from getMarginFiReports().
 */
let cachedReports: BankReport[] | null = null;
let lastFetchTime = 0;
const CACHE_DURATION_MS = 60_000; // 1 minute

/**
 * POST /api/chat
 *  1) Reads user message
 *  2) Ensures aggregator data is ready
 *  3) Builds aggregator context if user references MarginFi data
 *  4) Appends docs if requested
 *  5) Sends conversation + context to OpenAI
 *  6) Returns AI reply
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const sessionId = req.query.sessionId?.toString() || 'default';
    const { message } = req.body;

    if (!message) {
      console.log('[Chat Debug] No message in request body.');
      res.status(400).json({ error: 'Message is required.' });
      return;
    }

    // 1) Initialize conversation if none
    if (!conversationCache[sessionId]) {
      conversationCache[sessionId] = [];
    }

    // 2) Store the user's message
    conversationCache[sessionId].push({ role: 'user', content: message });
    console.log(`[Chat Debug] [${sessionId}] User Message: "${message}"`);

    // 3) Ensure aggregator data is loaded/still fresh
    const isReady = await ensureAggregatorData();
    if (!isReady) {
      const fallback = 'The data is currently being refreshed. Please try again in a moment.';
      conversationCache[sessionId].push({ role: 'assistant', content: fallback });
      console.log(`[Chat Debug] [${sessionId}] Data not ready. Returning fallback response.`);
      res.json({ reply: fallback });
      return;
    }

    // 4) Build aggregator context if user references MarginFi data
    let aggregatorContext = '';

    // (A) If user specifically says "show all banks," attach the full aggregator bullet list
    if (/show all banks/i.test(message)) {
      console.log(`[Chat Debug] [${sessionId}] User requested all banks => using getFullAggregatorString().`);
      aggregatorContext = await getFullAggregatorString();

    // (B) Otherwise, check if user’s message references marginfi data (partial aggregator logic)
    } else if (needsAggregatorData(message)) {
      aggregatorContext = await getAggregatorContext(sessionId, message);
    }

    // 5) If user wants the MarginFi docs, append them
    if (wantsMarginFiDocs(message)) {
      aggregatorContext += '\n\n' + MARGINFI_OVERVIEW;
    }

    // Debug logs
    console.log(`[Chat Debug] [${sessionId}] Aggregator Context: ${aggregatorContext ? 'Valid' : 'Empty'}`);
    if (aggregatorContext) {
      console.log('[Chat Debug] Context Preview:', aggregatorContext.slice(0, 300), '...');
    }

    // 6) Construct final instructions for OpenAI
    const finalContext = `
You are a conversational assistant specializing in MarginFi on Solana.
Users may say "hello" or ask general questions — respond politely and informatively.

When users ask about MarginFi data:
- If specific data about a MarginFi bank is requested, reference aggregator data if available.
- If a general overview is asked, summarize info from aggregator data or the docs.
- If no data is available for that request, say "No data is available."

Ensure responses are clear to a user with moderate DeFi knowledge.
Use correct USD formatting (e.g. $1,234.56) for asset values, and use % for APYs.

${aggregatorContext}
`;

    console.log(`[Chat Debug] [${sessionId}] Final Context length=${finalContext.length}`);

    // 7) Send conversation + final aggregator context to OpenAI
    const aiReply = await getOpenAIResponse(conversationCache[sessionId], finalContext);
    console.log(`[Chat Debug] [${sessionId}] AI Reply length=${aiReply.length}`);

    // 8) Store AI reply & respond
    conversationCache[sessionId].push({ role: 'assistant', content: aiReply });
    res.json({ reply: aiReply });

  } catch (error) {
    console.error('[Chat Route] Error:', error);
    res.status(500).json({ error: 'An error occurred while processing your request.' });
  }
});

/**
 * POST /api/chat/clear?sessionId=mySession
 * Clears conversation for that session
 */
router.post('/clear', (req: Request, res: Response) => {
  const sessionId = req.query.sessionId?.toString() || 'default';
  conversationCache[sessionId] = [];
  console.log(`[Chat Debug] [${sessionId}] Conversation cleared by user.`);
  res.json({ message: `Conversation cleared for session: ${sessionId}` });
});

/**
 * POST /api/chat/reset
 * Resets the aggregator cache so fresh data is fetched on the next query
 */
router.post('/reset', (req: Request, res: Response) => {
  cachedReports = null;
  lastFetchTime = 0;
  console.log('[Chat Debug] Aggregator cache reset triggered.');
  res.json({ message: 'Cache reset successfully. Fresh data will be fetched on the next query.' });
});

/* ------------------------------------------------------------------
   Helper Functions
   ------------------------------------------------------------------ */

/**
 * Re-fetch aggregator data if needed. Returns true if data is loaded, false otherwise.
 */
async function ensureAggregatorData(): Promise<boolean> {
  if (!cachedReports || (Date.now() - lastFetchTime > CACHE_DURATION_MS)) {
    console.log('[Chat Route] Data cache empty or stale. Fetching fresh data...');
    try {
      cachedReports = await getMarginFiReports();
      lastFetchTime = Date.now();
      console.log(`[Chat Route] aggregator data loaded with ${cachedReports.length} banks.`);
    } catch (err) {
      console.error('[Chat Route] Error fetching aggregator data:', err);
      return false;
    }
  }
  return !!(cachedReports && cachedReports.length > 0);
}

/**
 * Check if user’s message references marginfi data 
 * e.g. "bank", "apy", "assets", "liabilities", "marginfi", "top", "highest", "best", "total", etc.
 */
function needsAggregatorData(msg: string): boolean {
  // Add synonyms for "total" or "combined" if you like
  const aggregatorKeywords = /bank|apy|assets|liabilities|marginfi|top|highest|best|total|combined/i;
  return aggregatorKeywords.test(msg);
}

/** 
 * Check if user is requesting MarginFi docs/overview
 */
function wantsMarginFiDocs(msg: string): boolean {
  const docsRegex = /docs|documentation|overview|marginfi overview/i;
  return docsRegex.test(msg);
}

/**
 * Build aggregator context from userMessage & aggregator data
 * 
 * + short UTC timestamps for summaries
 */
async function getAggregatorContext(sessionId: string, userMessage: string): Promise<string> {
  if (!cachedReports || cachedReports.length === 0) {
    return '';
  }

  // 1) If user just says "hello"
  if (/^\s*hello\s*$/i.test(userMessage)) {
    const totalAssets = cachedReports.reduce((sum, b) => sum + parseUsd(b.assets), 0);
    return `Hello! Welcome to MarginFi, where ${cachedReports.length} banks manage ~$${totalAssets.toFixed(2)} in total assets. How can I assist you today?`;
  }

  // 2) If user says "banks?" => top 3 by assets
  if (/^\s*banks\??\s*$/i.test(userMessage)) {
    return buildTopN(cachedReports, 3, 'assets');
  }

  // 3) If user says "total" or "combined," show both total assets & liabilities
  if (/\b(total|combined)\b/i.test(userMessage)) {
    return buildTotalSummary(cachedReports);
  }

  // 4) "top N" or synonyms (top, highest, best)
  const topRegex = /(?:top|highest|best)\s+(\d+)?\s*(assets|liabilities|banks)?/i;
  const topMatch = topRegex.exec(userMessage);
  if (topMatch) {
    const rawCount = topMatch[1] || '3';
    const metric = topMatch[2] || 'assets'; 
    const count = parseInt(rawCount, 10) || 3;

    if (/liabilities/i.test(metric)) {
      return buildTopN(cachedReports, count, 'liabilities');
    }
    // If user typed "top 3 banks" => default is "assets"
    return buildTopN(cachedReports, count, 'assets');
  }

  // 5) If user specifically mentions "assets" or "liabilities" (but not "top")
  if (/assets/i.test(userMessage)) {
    return buildAssetsSummary(cachedReports);
  }
  if (/liabilities/i.test(userMessage)) {
    return buildLiabilitiesSummary(cachedReports);
  }

  // 6) Symbol-based request (e.g. "bonk assets?")
  const symbolMatch = userMessage.match(/\b([a-zA-Z]+)\b/i);
  if (symbolMatch) {
    const rawSymbol = symbolMatch[1];
    if (rawSymbol) {
      const symbol = rawSymbol.toUpperCase();
      const matched = cachedReports.filter((b) => b.tokenSymbol.toUpperCase() === symbol);
      if (matched.length === 0) {
        return `No data found for "${symbol}" in aggregator. If you’re sure ${symbol} is supported, please try again later.`;
      }
      return matched.map(formatBankData).join('\n');
    }
  }

  // 7) Default => Summarize total assets
  return buildAssetsSummary(cachedReports);
}

/** Summarize a single bank's data */
function formatBankData(b: BankReport): string {
  return `
**${b.tokenSymbol}**
- **Address**: ${b.address}
- **Assets**: ${b.assets}
- **Liabilities**: ${b.liabilities}
- **Lending APY**: ${b.lendingAPY}
- **Borrowing APY**: ${b.borrowingAPY}
`.trim();
}

/** Returns a short UTC timestamp like "2025-01-21 13:05 UTC" */
function getShortUtcTimestamp(): string {
  const d = new Date();
  return d.toISOString().slice(0,16).replace('T',' ') + ' UTC';
}

/** Summarize total assets across aggregator data */
function buildAssetsSummary(reports: BankReport[]): string {
  const nowStr = getShortUtcTimestamp();
  const totalAssets = reports.reduce((sum, b) => sum + parseUsd(b.assets), 0);

  return `As of ${nowStr}, total assets across all MarginFi banks are ~$${totalAssets.toFixed(2)}.`;
}

/** Summarize total liabilities across aggregator data */
function buildLiabilitiesSummary(reports: BankReport[]): string {
  const nowStr = getShortUtcTimestamp();
  const totalLiabilities = reports.reduce((sum, b) => sum + parseUsd(b.liabilities), 0);

  return `As of ${nowStr}, total liabilities across all MarginFi banks are ~$${totalLiabilities.toFixed(2)}.`;
}

/**
 * Summarize *both* total assets and total liabilities for "total" or "combined" queries
 */
function buildTotalSummary(reports: BankReport[]): string {
  const nowStr = getShortUtcTimestamp();
  const totalAssets = reports.reduce((sum, b) => sum + parseUsd(b.assets), 0);
  const totalLiabilities = reports.reduce((sum, b) => sum + parseUsd(b.liabilities), 0);

  return `As of ${nowStr}, total assets across all MarginFi banks are ~$${totalAssets.toFixed(2)}, and total liabilities are ~$${totalLiabilities.toFixed(2)}.`;
}

/**
 * Build "top N" listing by either assets or liabilities (with short UTC timestamp)
 */
function buildTopN(reports: BankReport[], n: number, field: 'assets' | 'liabilities'): string {
  const nowStr = getShortUtcTimestamp();
  const valid = reports.filter((r) => parseUsd(r[field]) > 0);
  if (valid.length === 0) {
    return `No banks have sufficient ${field} data to display.`;
  }

  // Sort descending
  const sorted = [...valid].sort((a, b) => parseUsd(b[field]) - parseUsd(a[field]));
  const sliced = sorted.slice(0, n);

  let out = `As of ${nowStr}, here are the top ${n} banks by **${field}**:\n`;
  sliced.forEach((bank, i) => {
    out += `${i + 1}. **${bank.tokenSymbol}** (Address: ${bank.address})
   - **Assets**: ${bank.assets}
   - **Liabilities**: ${bank.liabilities}
   - **Lending APY**: ${bank.lendingAPY}
   - **Borrowing APY**: ${bank.borrowingAPY}\n\n`;
  });

  if (valid.length > n) {
    out += `Would you like to see more banks or sort by another metric? (e.g. liabilities or APY)`;
  }

  return out.trim();
}

/** Convert "$123.45" => 123.45 */
function parseUsd(str: string): number {
  return parseFloat(str.replace(/[^0-9.]/g, '')) || 0;
}

export default router;