// backend/src/index.ts

import dotenv from 'dotenv';
dotenv.config();

import app from './app';
import { getMarginFiReports } from './marginfiMacroAggregator';

/**
 * In-memory cache placeholders for aggregator data.
 */
let cachedReports = null;
let lastFetchTime = 0;
const CACHE_DURATION_MS = 60_000; // 1 minute

/**
 * Fetch aggregator data once on startup.
 * This ensures we have data cached before the first user queries the bot.
 */
async function initializeAggregatorCache() {
  try {
    cachedReports = await getMarginFiReports(); // purely for logs here; the aggregator also caches internally
    lastFetchTime = Date.now();
    console.log(`[Aggregator Init] Successfully cached ${cachedReports.length} banks on startup.`);
  } catch (error) {
    console.error('[Aggregator Init] Error fetching data:', error);
    cachedReports = null; // Mark as unavailable
  }
}

/**
 * Periodically refresh aggregator data in the background.
 * By default, updates every 60 seconds.
 */
setInterval(async () => {
  try {
    cachedReports = await getMarginFiReports(); // aggregator’s own caching still applies
    lastFetchTime = Date.now();
    console.log(`[Aggregator Refresh] Refreshed with ${cachedReports.length} banks.`);
  } catch (error) {
    console.error('[Aggregator Refresh] Error:', error);
  }
}, CACHE_DURATION_MS);

// Trigger initial data fetch immediately
initializeAggregatorCache();

/**
 * Start the server on port 80 by default, as expected by Replit.
 */
const PORT = process.env.PORT || 80; // Replit expects port 80
app.listen(PORT, () => {
  console.log(`[Index] Server is running on port ${PORT}`);
});