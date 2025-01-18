import { SolanaAgentKit } from "solana-agent-kit";
import "dotenv/config";

let agent: SolanaAgentKit | null = null;

/**
 * initAgent
 * 
 * Creates (or returns an existing) SolanaAgentKit instance using:
 *  - HELIUS_RPC_URL
 *  - SOLANA_PRIVATE_KEY_JSON
 *  - OPENAI_API_KEY (optional)
 */
export function initAgent(): SolanaAgentKit {
  if (agent) return agent; // already created

  const heliusUrl = process.env.HELIUS_RPC_URL || "https://mainnet.helius-rpc.com/?api-key=f494919d-87b0-4f0d-a8a3-f3c05d5e17ee";
  const privateKey = process.env.SOLANA_PRIVATE_KEY_JSON || "";
  const openaiKey = process.env.OPENAI_API_KEY || "";

  // Create the kit
  agent = new SolanaAgentKit(privateKey, heliusUrl, openaiKey);

  console.log(`Initialized SolanaAgentKit with RPC => ${heliusUrl}`);
  // Optionally log if openaiKey was provided or not.

  return agent;
}