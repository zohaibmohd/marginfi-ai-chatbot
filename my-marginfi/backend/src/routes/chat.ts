// backend/src/routes/chat.ts

import express, { Request, Response } from 'express';
import { getMarginFiReports, BankReport } from '../marginfiMacroAggregator';
import { getOpenAIResponse } from '../services/openAI';

const router = express.Router();

router.post('/', async (req: Request, res: Response): Promise<void> => {
  const { message } = req.body;

  if (!message) {
    res.status(400).json({ error: 'Message is required.' });
    return;
  }

  try {
    // Fetch MarginFi data
    const marginFiData: BankReport[] = await getMarginFiReports();

    // Prepare data context for AI
    const dataContext = marginFiData.map(bank => `
Bank Address: ${bank.address}
Token Symbol: ${bank.tokenSymbol}
Mint: ${bank.mint}
State: ${bank.state}
TVL: ${bank.tvl}
Assets: ${bank.assets}
Liabilities: ${bank.liabilities}
Utilization: ${bank.utilization}
Lending APY: ${bank.lendingAPY}
Borrowing APY: ${bank.borrowingAPY}
`).join('\n');

    // Generate prompt for OpenAI
    const prompt = `
You are a knowledgeable assistant specializing in the MarginFi protocol. Here is the current data about MarginFi banks:

${dataContext}

Provide detailed and insightful recommendations based on the above data.

User Query: ${message}
`;

    // Get response from OpenAI
    const aiResponse = await getOpenAIResponse(prompt);

    res.json({ reply: aiResponse });
  } catch (error: any) {
    console.error('Error in chat route:', error);
    res.status(500).json({ error: 'An error occurred while processing your request.' });
  }
});

export default router;