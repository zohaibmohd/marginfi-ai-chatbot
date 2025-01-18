/**
 * tokenRegistry.ts
 *
 * - Fetches the official Solana token list (or any SPL list you prefer)
 * - Maps each mint address => a symbol or name
 * - Also supports custom overrides for tokens not on the list
 */

import fetch from "node-fetch";

// In-memory cache for official SPL registry
let SPL_REGISTRY: Record<string, string> = {};
let LOADED = false;

// Optional custom overrides
const OVERRIDE_SYMBOLS: Record<string, string> = {
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v": "USDC", // official USDC
  // Add more if needed...
};

export async function initTokenRegistry() {
  if (LOADED) return;

  console.log("=> Loading SPL token registry from remote...");
  const url =
    "https://raw.githubusercontent.com/solana-labs/token-list/main/src/tokens/solana.tokenlist.json";

  try {
    const resp = await fetch(url);
    if (!resp.ok) {
      console.warn("Token Registry fetch failed =>", resp.status, resp.statusText);
      return; // fallback to empty or partial data
    }
    const data = await resp.json();
    if (!data.tokens) {
      console.warn("No 'tokens' array found in registry JSON. Continuing anyway.");
      return;
    }

    let count = 0;
    for (const t of data.tokens) {
      if (t.address && t.symbol) {
        SPL_REGISTRY[t.address] = t.symbol;
        count++;
      }
    }
    LOADED = true;
    console.log(`✅ Token registry loaded => ${count} tokens recognized.`);
  } catch (err) {
    console.warn("Error loading token registry:", err);
  }
}

/**
 * getSymbolForMint(mint: string)
 *   - Check custom overrides first
 *   - Then see if we have an official symbol
 *   - Else fallback to the first 4 characters
 */
export function getSymbolForMint(mint: string): string {
  if (OVERRIDE_SYMBOLS[mint]) {
    return OVERRIDE_SYMBOLS[mint];
  }
  if (SPL_REGISTRY[mint]) {
    return SPL_REGISTRY[mint];
  }
  return mint.slice(0, 4); // fallback
}