// backend/src/services/openAI.ts

import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

/**
 * Sends conversation + aggregatorContext to OpenAI's ChatCompletion.
 * 
 * @param conversationMessages - The existing array of conversation messages (user + assistant).
 * @param aggregatorContext - Any additional system data or instructions (e.g., bank info, disclaimers).
 * @param options - Additional parameters (model, temperature, max_tokens, top_p).
 * @returns The AI-generated text response.
 */
export async function getOpenAIResponse(
  conversationMessages: Array<{ role: 'user' | 'assistant'; content: string }>,
  aggregatorContext = '',
  options?: {
    model?: string;
    temperature?: number;
    max_tokens?: number;
    top_p?: number;
  }
): Promise<string> {
  const {
    // Default to GPT-3.5 or your custom model name
    model = 'gpt-4o-mini',
    temperature = 0.7,
    max_tokens = 512,
    top_p = 1,
  } = options || {};

  // Primary system instructions
  const systemMessage = {
    role: 'system' as const,
    content: `
You are an advanced AI assistant specializing in MarginFi on Solana.
Many of your users are high-frequency traders who rely on accurate, real-time DeFi insights.
You may receive general greetings or non-DeFi queries; please respond politely and helpfully.

If aggregatorContext is provided, use it for MarginFi data:
• Only reference banks or metrics actually listed in aggregatorContext.
• If aggregatorContext explicitly says "No data found" for a bank, do NOT fabricate data.
• If asked about a bank not in aggregatorContext, respond with "No aggregator data found for that bank name. Please refresh or check back later."
• If aggregatorContext is empty, do NOT say "No data is available." Instead, greet or respond politely (e.g. "Hello! How can I help you today?").

Always use correct USD formatting (e.g. $1,234.56) for values and % for APYs.
Never invent or guess data beyond the aggregatorContext.
If the user asks for an unknown or ambiguous metric, politely explain it’s not tracked by the aggregator.
    `,
  };

  // If aggregatorContext is non-empty, we add it as a second system-level message
  const aggregatorMessage = aggregatorContext
    ? { role: 'system' as const, content: aggregatorContext }
    : null;

  // Combine system + aggregator context + conversation
  const messages = [
    systemMessage,
    ...(aggregatorMessage ? [aggregatorMessage] : []),
    ...conversationMessages,
  ];

  try {
    const response = await openai.chat.completions.create({
      model,
      messages,
      max_tokens,
      temperature,
      top_p,
    });

    const choice = response.choices[0];
    return choice?.message?.content || '';
  } catch (error: any) {
    console.error('[OpenAI] Error calling ChatCompletion:', error);
    throw new Error('OpenAI API call failed');
  }
}