/**
 * marginfiAiBot.ts
 *
 * Minimal CLI script to:
 *   1) Initialize token registry
 *   2) Check if user wants direct "getHistoricalRates"
 *   3) Otherwise pass user query to askMarginfiAi
 */

import { initTokenRegistry } from "./tokenRegistry";
import { askMarginfiAi } from "./marginfiAiBotCore";

// If you want direct calls
import { getHistoricalRates } from "./marginfiAiTool";

(async function main() {
  try {
    // 1) Load token registry
    await initTokenRegistry();

    // 2) Grab user input from CLI
    const userQ = process.argv.slice(2).join(" ");
    if (!userQ) {
      console.log("Please provide a question or command!");
      process.exit(0);
    }

    // 3) OPTIONAL direct parse for "Get historical rates for mint X timeframe=Y"
    const match = userQ.match(/Get historical rates for mint\s+(\S+)\s+timeframe=(\S+)/i);
    if (match) {
      const mint = match[1];
      const timeframeStr = match[2];
      if (!["1d", "7d", "30d"].includes(timeframeStr)) {
        console.log("Invalid timeframe. Must be 1d, 7d, or 30d");
        return;
      }

      console.log(`[Direct call] getHistoricalRates => mint=${mint}, timeframe=${timeframeStr}`);
      try {
        const result = await getHistoricalRates({ mint, timeframe: timeframeStr as "1d" | "7d" | "30d" });
        console.log("\nAI says =>\n", result, "\n");
      } catch (err) {
        console.error("Failed to call getHistoricalRates directly:", err);
      }
      return;
    }

    // 4) Otherwise, ask GPT aggregator
    const answer = await askMarginfiAi(userQ);
    console.log("\nAI says =>\n", answer, "\n");
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
})();