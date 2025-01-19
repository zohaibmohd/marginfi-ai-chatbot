import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import chatRouter from './routes/chat';

dotenv.config();

const app = express();

// Enable CORS for the frontend origin
app.use(cors({
  origin: 'https://cbdc270c-1e23-48d1-8536-9abef23748f0-00-rzp48oi2o60k.picard.replit.dev', // Replace with your frontend's URL if different
  methods: ['GET', 'POST'],
  credentials: true
}));

app.use(express.json());

// Serve static files from the frontend's build directory
app.use(express.static(path.join(__dirname, '../frontend/dist')));

// API Routes
app.use('/api/chat', chatRouter);

// For any other route, serve the frontend's index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist', 'index.html'));
});

export default app;