"use strict";
// backend/src/routes/chat.ts
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
const express_1 = __importDefault(require("express"));
const marginfiMacroAggregator_1 = require("../marginfiMacroAggregator");
const openAI_1 = require("../services/openAI");
const router = express_1.default.Router();
router.post('/', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { message } = req.body;
    if (!message) {
        res.status(400).json({ error: 'Message is required.' });
        return;
    }
    try {
        // Fetch MarginFi data
        const marginFiData = yield (0, marginfiMacroAggregator_1.getMarginFiReports)();
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
        const aiResponse = yield (0, openAI_1.getOpenAIResponse)(prompt);
        res.json({ reply: aiResponse });
    }
    catch (error) {
        console.error('Error in chat route:', error);
        res.status(500).json({ error: 'An error occurred while processing your request.' });
    }
}));
exports.default = router;
