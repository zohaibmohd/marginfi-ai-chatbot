/**
 * marginfiAiBotCore.ts
 *
 * Purpose:
 *   - GPT orchestration: define aggregator "function" specs for everything
 *     in marginfiAiTool.ts so GPT can call them by name.
 */

import { OpenAI } from "openai";
import "dotenv/config";

// Import aggregator schemas + functions
import {
  topBanksSchema,
  getTopBanks,
  totalTvlSchema,
  getTotalTvl,
  bankDetailSchema,
  getBankDetail,
  historicalRatesSchema,
  getHistoricalRates,
  getVolatility,
  netApySchema,
  getNetApy,
  getLiquidationsSchema,
  getLiquidations,
  getAccountBalanceSummarySchema,
  getAccountBalanceSummary,
  topBanksByEmissionsSchema,
  getTopBanksByEmissions,
  bestLoopingOpportunitySchema,
  getBestLoopingOpportunity,
  filteredBanksSchema,
  getFilteredBanks,
} from "./marginfiAiTool";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function askMarginfiAi(userQuestion: string): Promise<string> {
  const functionSpecs = [
    {
      name: "getTopBanks",
      description: "Rank Marginfi banks by a chosen metric and return top N results.",
      parameters: {
        type: "object",
        properties: {
          by: {
            type: "string",
            enum: [
              "lendingRate",
              "borrowRate",
              "tvl",
              "utilization",
              "emissions",
              "insuranceFeeFixedApr",
              "protocolFixedFeeApr",
            ],
            description: "Which metric to rank by",
          },
          limit: {
            type: "number",
            description: "How many banks to return",
          },
        },
        required: [],
      },
    },
    {
      name: "getTotalTvl",
      description: "Compute total Marginfi TVL across all banks.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
    {
      name: "getBankDetail",
      description: "Get stats (rates, utilization, tvl) for a bank by mint address.",
      parameters: {
        type: "object",
        properties: {
          mint: { type: "string" },
        },
        required: ["mint"],
      },
    },
    {
      name: "getHistoricalRates",
      description: "Retrieve historical interest rates for a bank, plus volatility.",
      parameters: {
        type: "object",
        properties: {
          mint: { type: "string" },
          timeframe: { type: "string", enum: ["1d", "7d", "30d"] },
        },
        required: ["mint"],
      },
    },
    {
      name: "getVolatility",
      description: "Stub aggregator returning volatility for a given mint (placeholder).",
      parameters: {
        type: "object",
        properties: {
          mint: { type: "string" },
        },
        required: ["mint"],
      },
    },
    {
      name: "getNetApy",
      description: "Compute net APYs for lending/borrowing after fees for a bank mint.",
      parameters: {
        type: "object",
        properties: {
          mint: { type: "string" },
        },
        required: ["mint"],
      },
    },
    {
      name: "getLiquidations",
      description: "Fetch recent liquidation events (limit=5 by default).",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number" },
        },
        required: [],
      },
    },
    {
      name: "getAccountBalanceSummary",
      description: "Fetch summary of positions and total value for a marginfi account.",
      parameters: {
        type: "object",
        properties: {
          accountId: { type: "string" },
        },
        required: ["accountId"],
      },
    },
    {
      name: "getTopBanksByEmissions",
      description: "List top banks by emissions for lending or borrowing.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number" },
          type: { type: "string", enum: ["lending", "borrowing"] },
        },
        required: [],
      },
    },
    {
      name: "getBestLoopingOpportunity",
      description: "Find the best deposit/borrow combos for a looping strategy (stub).",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
    {
      name: "getFilteredBanks",
      description: "Return banks that match certain utilization or exclude lists.",
      parameters: {
        type: "object",
        properties: {
          utilizationMin: { type: "number" },
          utilizationMax: { type: "number" },
          excludeMints: {
            type: "array",
            items: { type: "string" },
          },
        },
        required: [],
      },
    },
  ];

  // Example system message
  const systemMessage = {
    role: "system" as const,
    content: `
      You are a specialized MarginFi aggregator AI. 
      - If the user asks for or mentions "historical rates" or a "timeframe", call "getHistoricalRates".
      - If the user mentions "net APY", call "getNetApy" with "mint".
      - If the user says "total tvl" => call "getTotalTvl"
      - If the user references "bank details" => call "getBankDetail" with the given mint
      - If user wants to rank or list banks => "getTopBanks"
      - For "emissions" => "getTopBanksByEmissions"
      - If no aggregator fits, provide a generic knowledge-based answer
    `,
  };

  const messages = [
    systemMessage,
    { role: "user" as const, content: userQuestion },
  ];

  const response = await openai.chat.completions.create({
    model: "gpt-4-0613",
    messages,
    functions: functionSpecs,
    function_call: "auto",
  });

  const msg = response.choices[0].message;
  if (!msg) return "No response from GPT!";

  if (msg.function_call) {
    const fnName = msg.function_call.name;
    const argsStr = msg.function_call.arguments || "{}";

    if (fnName === "getTopBanks") {
      const parsed = JSON.parse(argsStr);
      const validated = topBanksSchema.parse(parsed);
      const result = await getTopBanks(validated);

      const followup = await openai.chat.completions.create({
        model: "gpt-4-0613",
        messages: [
          {
            role: "system",
            content: `Summarize top banks by the chosen metric. 
            List each bank's symbol and score in short form.`,
          },
          {
            role: "user",
            content: `Aggregator result => ${JSON.stringify(result)}`,
          },
        ],
      });
      return followup.choices[0].message?.content ?? JSON.stringify(result);

    } else if (fnName === "getTotalTvl") {
      // ...
      const parsed = JSON.parse(argsStr);
      totalTvlSchema.parse(parsed);
      const result = await getTotalTvl({});
      return `**Marginfi total TVL** => ${result.totalTvl} across ${result.bankCount} banks.`;

    } else if (fnName === "getBankDetail") {
      // ...
      const parsed = JSON.parse(argsStr);
      const validated = bankDetailSchema.parse(parsed);
      const detail = await getBankDetail(validated);
      if (detail.error) return `❌ ${detail.error}`;

      // second pass summary
      const followup = await openai.chat.completions.create({
        model: "gpt-4-0613",
        messages: [
          {
            role: "system",
            content: `Summarize a single bank's details (symbol, rates, utilization, TVL, etc.).`,
          },
          {
            role: "user",
            content: `Aggregator result => ${JSON.stringify(detail)}`,
          },
        ],
      });
      return followup.choices[0].message?.content ?? JSON.stringify(detail);

    } else if (fnName === "getHistoricalRates") {
      // ...
      const parsed = JSON.parse(argsStr);
      const validated = historicalRatesSchema.parse(parsed);
      const result = await getHistoricalRates(validated);
      if (result.error) return `❌ ${result.error}`;
      // second pass
      const followup = await openai.chat.completions.create({
        model: "gpt-4-0613",
        messages: [
          {
            role: "system",
            content: `Present historical interest rates for the timeframe, highlight big changes.`,
          },
          {
            role: "user",
            content: `Aggregator result => ${JSON.stringify(result)}`,
          },
        ],
      });
      return followup.choices[0].message?.content ?? JSON.stringify(result);

    } else if (fnName === "getVolatility") {
      const parsed = JSON.parse(argsStr);
      const result = await getVolatility(parsed.mint);
      // second pass
      const followup = await openai.chat.completions.create({
        model: "gpt-4-0613",
        messages: [
          {
            role: "system",
            content: `Explain volatility in user-friendly terms, referencing aggregator result.`,
          },
          {
            role: "user",
            content: `Aggregator result => ${JSON.stringify(result)}`,
          },
        ],
      });
      return followup.choices[0].message?.content ?? JSON.stringify(result);

    } else if (fnName === "getNetApy") {
      // ...
      const parsed = JSON.parse(argsStr);
      const validated = netApySchema.parse(parsed);
      const result = await getNetApy(validated);
      if (result.error) return `❌ ${result.error}`;
      // second pass
      const followup = await openai.chat.completions.create({
        model: "gpt-4-0613",
        messages: [
          {
            role: "system",
            content: `Summarize net APYs for lending vs. borrowing after fees.`,
          },
          {
            role: "user",
            content: `Aggregator result => ${JSON.stringify(result)}`,
          },
        ],
      });
      return followup.choices[0].message?.content ?? JSON.stringify(result);

    } else if (fnName === "getLiquidations") {
      // ...
      const parsed = JSON.parse(argsStr);
      const validated = getLiquidationsSchema.parse(parsed);
      const result = await getLiquidations(validated);
      // second pass
      const followup = await openai.chat.completions.create({
        model: "gpt-4-0613",
        messages: [
          {
            role: "system",
            content: `Summarize liquidation events (account, collateral, price).`,
          },
          {
            role: "user",
            content: `Aggregator result => ${JSON.stringify(result)}`,
          },
        ],
      });
      return followup.choices[0].message?.content ?? JSON.stringify(result);

    } else if (fnName === "getAccountBalanceSummary") {
      // ...
      const parsed = JSON.parse(argsStr);
      const validated = getAccountBalanceSummarySchema.parse(parsed);
      const result = await getAccountBalanceSummary(validated);
      // second pass
      const followup = await openai.chat.completions.create({
        model: "gpt-4-0613",
        messages: [
          {
            role: "system",
            content: `Summarize a marginfi account's positions, total value, net leverage, etc.`,
          },
          {
            role: "user",
            content: `Aggregator result => ${JSON.stringify(result)}`,
          },
        ],
      });
      return followup.choices[0].message?.content ?? JSON.stringify(result);

    } else if (fnName === "getTopBanksByEmissions") {
      // ...
      const parsed = JSON.parse(argsStr);
      const validated = topBanksByEmissionsSchema.parse(parsed);
      const result = await getTopBanksByEmissions(validated);
      // second pass
      const followup = await openai.chat.completions.create({
        model: "gpt-4-0613",
        messages: [
          {
            role: "system",
            content: `Summarize top banks by emissions, referencing the 'lending' or 'borrowing' type.`,
          },
          {
            role: "user",
            content: `Aggregator result => ${JSON.stringify(result)}`,
          },
        ],
      });
      return followup.choices[0].message?.content ?? JSON.stringify(result);

    } else if (fnName === "getBestLoopingOpportunity") {
      // ...
      const parsed = JSON.parse(argsStr);
      const validated = bestLoopingOpportunitySchema.parse(parsed);
      const result = await getBestLoopingOpportunity(validated);
      // second pass
      const followup = await openai.chat.completions.create({
        model: "gpt-4-0613",
        messages: [
          {
            role: "system",
            content: `Summarize best deposit/borrow combos for a looping strategy, mention net APY & recommended leverage.`,
          },
          {
            role: "user",
            content: `Aggregator result => ${JSON.stringify(result)}`,
          },
        ],
      });
      return followup.choices[0].message?.content ?? JSON.stringify(result);

    } else if (fnName === "getFilteredBanks") {
      // ...
      const parsed = JSON.parse(argsStr);
      const validated = filteredBanksSchema.parse(parsed);
      const result = await getFilteredBanks(validated);
      // second pass
      const followup = await openai.chat.completions.create({
        model: "gpt-4-0613",
        messages: [
          {
            role: "system",
            content: `Summarize banks matching the filters (utilization range, excludes) in a neat list.`,
          },
          {
            role: "user",
            content: `Aggregator result => ${JSON.stringify(result)}`,
          },
        ],
      });
      return followup.choices[0].message?.content ?? JSON.stringify(result);
    }

    return "No matching aggregator function found.";
  }

  return msg.content ?? "No function call / no text response";
}