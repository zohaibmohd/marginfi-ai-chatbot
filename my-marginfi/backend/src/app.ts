// backend/src/app.ts

import express from 'express';
import cors from 'cors';
import path from 'path';
import chatRouter from './routes/chat';

const app = express();

// Configure CORS for your Replit domain (or another domain you prefer)
app.use(
  cors({
    origin: 'https://marginfi-ai-kit-zohaibmohd.replit.app',
    methods: ['GET', 'POST'],
    credentials: true,
  })
);

// Parse JSON bodies
app.use(express.json());

// Serve the frontend's compiled dist folder
const FRONTEND_DIST_PATH = path.resolve(__dirname, '..', '..', 'frontend', 'dist');
console.log('[App] Serving static files from:', FRONTEND_DIST_PATH);
app.use(express.static(FRONTEND_DIST_PATH));

// Attach the chatbot route at /api/chat
app.use('/api/chat', chatRouter);

// Catch-all: send index.html for any unknown route (useful for React SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(FRONTEND_DIST_PATH, 'index.html'));
});

export default app;