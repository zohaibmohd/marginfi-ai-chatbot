// backend/src/services/openAI.ts

import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  throw new Error('OpenAI API key not found in environment variables.');
}

/**
 * Sends a prompt to OpenAI's GPT model and retrieves the response.
 * @param prompt - The prompt to send to OpenAI.
 * @returns The AI-generated response as a string.
 */
export const getOpenAIResponse = async (prompt: string): Promise<string> => {
  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are an expert assistant specialized in the MarginFi protocol.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 500,
        temperature: 0.7,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
      }
    );

    const aiText = response.data.choices[0].message.content.trim();
    return aiText;
  } catch (error: any) {
    console.error('Error communicating with OpenAI:', error.response?.data || error.message);
    throw new Error('Failed to get response from OpenAI.');
  }
};