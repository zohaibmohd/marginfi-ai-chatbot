# MarginFi AI Chatbot

## Overview

The **MarginFi AI Chatbot** is a conversational assistant designed to provide real-time insights into the [MarginFi](https://marginfi.com/) protocol on Solana. It retrieves and summarizes data about banks, assets, liabilities, and APYs, allowing users to explore MarginFi via a simple chat interface.

### Key Features

- **Conversational Queries**: Understands and responds to natural language questions like “top banks by assets,” “total liabilities,” or “What is JitoSOL?”
- **Real-Time Data**: Fetches fresh data from the MarginFi protocol (via Helius RPC) every 60 seconds, caching it for quick responses.
- **Session Awareness**: Maintains context for follow-up queries in a single chat session.
- **Markdown Formatting**: Uses simple markdown formatting for a readable display of data and metrics.

---

## Architecture

This project consists of two main parts:

1. **Backend**:
   - **Tech Stack**: Node.js, Express, TypeScript.
   - **Core Responsibilities**:
     - Fetches and caches up-to-date MarginFi data via the marginfi-client-v2 SDK.
     - Serves an API endpoint (`/api/chat`) that processes user messages and returns AI-generated replies.
     - Uses OpenAI’s GPT models to generate natural language responses.

2. **Frontend**:
   - **Tech Stack**: React, Vite.
   - **Core Responsibilities**:
     - Renders a user-friendly chat interface.
     - Sends user queries to the backend (`/api/chat`).
     - Displays the AI’s responses in real time.

---

## Deployment

The chatbot is currently hosted on **Replit** for 24/7 availability. 

### Replit Link (Live Demo)
[**MarginFi AI Chatbot**](https://marginfi-ai-kit-zohaibmohd.replit.app)

This link points to a production instance with autoscaling enabled.

### Repo
[**GitHub Link**](https://github.com/zohaibmohd/marginfi-ai-chatbot)


---

## Usage Examples

1. **Greeting**  
   - **User**: “Hello”  
   - **Bot**: “Hello! Welcome to MarginFi, where 65 banks manage ~$500,000,000 in total assets…”

2. **Top Banks**  
   - **User**: “Top banks by assets”  
   - **Bot**: “As of 2025-01-21 13:00 UTC, here are the top 3 banks by assets: 1. JitoSOL …”

3. **Specific Bank**  
   - **User**: “What is JitoSOL?”  
   - **Bot**: “JitoSOL (Short Description) - Assets: $132,865,805.95 …”

4. **Show More**  
   - **User**: “Show more banks”  
   - **Bot**: “Here are the next 3 banks by assets… Would you like to see more?”

5. **Total**  
   - **User**: “total assets?”  
   - **Bot**: “As of 2025-01-21 13:05 UTC, total assets across all MarginFi banks are ~$493,794,556.28…”

---

## Local Setup

If you’d like to run this project locally or on another platform:

1. **Clone the Repository**  
   ```bash
   git clone https://github.com/your-repo/marginfi-ai.git
   cd marginfi-ai

	2.	Backend Setup

cd backend
npm install

# Create a .env file for your environment variables:
# .env
# MY_MAINNET_URL=https://mainnet.helius-rpc.com/?api-key=[YOUR_HELIUS_API_KEY]
# OPENAI_API_KEY=[YOUR_OPENAI_API_KEY]
# PORT=8080
#
# Then build and start:
npm run build
npm run start


	3.	Frontend Setup

cd ../frontend
npm install

# Create a .env file specifying the backend URL:
# .env
# VITE_BACKEND_URL=http://localhost:8080/api/chat
#
# Then run locally:
npm run dev

	•	Open http://localhost:5173 (default Vite port) in your browser.

	4.	Testing
	•	Type queries like “hello” or “top banks” in the chat interface.
	•	Confirm that the data loads and the bot responds with real data.

Environment Variables

Variable	Description	Example
MY_MAINNET_URL	Solana RPC URL with Helius API key for fetching on-chain data	https://mainnet.helius-rpc.com/?api-key=xxxxx
OPENAI_API_KEY	Your OpenAI API key for GPT model calls	sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
PORT	The port on which the backend listens	8080
VITE_BACKEND_URL	(Frontend) The URL pointing to the backend’s /api/chat	http://localhost:8080/api/chat (for local dev)

Limitations
	•	API Rate Limits: The aggregator may fail if you exceed the Helius or OpenAI rate limits.
	•	Data Freshness: Data is cached every 60 seconds. Minor delays in reflecting changes on-chain may occur.
	•	Session Memory: The chatbot retains conversation context in memory. Upon server restarts, context is lost.

Contributing
	1.	Fork the repository.
	2.	Create a feature branch: git checkout -b feature/my-feature.
	3.	Commit your changes: git commit -m "Add new feature".
	4.	Push to the branch: git push origin feature/my-feature.
	5.	Open a Pull Request in the main repo.

Contact & Support
	•	Email: zohaib.m323@gmail.com
	•	GitHub: [GitHub Repo](https://github.com/zohaibmohd)

For questions or issues, feel free to open an issue or reach out via email.