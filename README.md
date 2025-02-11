# marginfi AI Chatbot

## Overview

The marginfi AI Chatbot is a conversational assistant designed to provide real-time insights into the marginfi protocol on Solana. It retrieves and summarizes data about banks, assets, liabilities, and APYs, allowing users to explore marginfi through a simple chat interface.

## Key Features

*   **Conversational Queries:** Understands and responds to natural language questions like "top banks by assets," "total liabilities," or "What is JitoSOL?".
*   **Real-Time Data:** Fetches fresh data from the marginfi protocol (via Helius RPC) every 60 seconds and caches it for quick responses.
*   **Session Awareness:** Maintains context for follow-up queries within a single chat session.
*   **Markdown Formatting:** Uses simple markdown formatting for a readable display of data and metrics.

## Architecture

### Backend

*   **Tech Stack:** Node.js, Express, TypeScript
*   **Core Responsibilities:**
    *   Fetches and caches up-to-date MarginFi data via the `marginfi-client-v2` SDK.
    *   Serves an API endpoint (`/api/chat`) that processes user messages and returns AI-generated replies.
    *   Uses OpenAI's GPT models to generate natural language responses.

### Frontend

*   **Tech Stack:** React, Vite
*   **Core Responsibilities:**
    *   Renders a user-friendly chat interface.
    *   Sends user queries to the backend (`/api/chat`).
    *   Displays the AI's responses in real time.

## Repository

**GitHub Repository:** [MarginFi AI Chatbot](https://github.com/zohaibmohd/marginfi-ai-chatbot)

## Usage Examples

1. **Greeting**
    ```
    User: Hello
    Bot: Hello! Welcome to MarginFi, where 65 banks manage ~$500,000,000 in total assets...
    ```
2. **Top Banks**
    ```
    User: Top banks by assets
    Bot: As of 2025-01-21 13:00 UTC, here are the top 3 banks by assets:
    * JitoSOL
    * USDC
    * SOL
    ```
3. **Specific Bank**
    ```
    User: What is JitoSOL?
    Bot: JitoSOL (Short Description) - Assets: $132,865,805.95 ...
    ```
4. **Show More**
    ```
    User: Show more banks
    Bot: Here are the next 3 banks by assets... Would you like to see more?
    ```
5. **Total Assets**
    ```
    User: Total assets?
    Bot: As of 2025-01-21 13:05 UTC, total assets across all MarginFi banks are ~$493,794,556.28...
    ```

## Local Setup

If you'd like to run this project locally or on another platform:

1. **Clone the Repository**

    ```bash
    git clone YOUR_GITHUB_REPOSITORY_LINK_HERE
    cd marginfi-ai-chatbot
    ```

2. **Backend Setup**

    ```bash
    cd backend
    npm install
    ```

    Create a `.env` file in the `backend` directory and add the following environment variables:

    ```env
    MY_MAINNET_URL=YOUR_HELIUS_RPC_URL_WITH_API_KEY
    OPENAI_API_KEY=YOUR_OPENAI_API_KEY
    PORT=8080
    ```

    Build and start the backend:

    ```bash
    npm run build
    npm run start
    ```

3. **Frontend Setup**

    ```bash
    cd ../frontend
    npm install
    ```

    Create a `.env` file in the `frontend` directory and add the following environment variable:

    ```env
    VITE_BACKEND_URL=http://localhost:8080/api/chat
    ```

    Start the frontend locally:

    ```bash
    npm run dev
    ```

    Open `http://localhost:5173` (or the port shown in your terminal after running `npm run dev`) in your browser.

4. **Testing**

    *   Type queries like "Hello" or "Top banks" in the chat interface.
    *   Confirm that the data loads and the bot responds with real data.

## Environment Variables

| Variable            | Description                                                    | Example                                                                   |
| ------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `MY_MAINNET_URL`    | Solana RPC URL with Helius API key for on-chain data            | `https://mainnet.helius-rpc.com/?api-key=YOUR_HELIUS_API_KEY`          |
| `OPENAI_API_KEY`    | Your OpenAI API key for GPT model calls                         | `sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`                    |
| `PORT`              | Port for the backend server                                     | `8080`                                                                    |
| `VITE_BACKEND_URL`  | Backend API URL (for frontend communication)                    | `http://localhost:8080/api/chat`                                         |

## Limitations

*   **API Rate Limits:** The chatbot's functionality may be limited if Helius or OpenAI API rate limits are exceeded.
*   **Data Freshness:** Data is cached every 60 seconds, so there may be minor delays in reflecting the most recent on-chain changes.
*   **Session Memory:** The chatbot retains conversation context in memory, which is lost upon server restarts.

## Contributing

Contributions are welcome! Here's how you can contribute:

1. Fork the repository.
2. Create a feature branch:

    ```bash
    git checkout -b feature/my-feature
    ```

3. Commit your changes:

    ```bash
    git commit -m "Add new feature"
    ```

4. Push to the branch:

    ```bash
    git push origin feature/my-feature
    ```

5. Open a Pull Request.

## Contact & Support

*   **Email:** zohaib.m323@gmail.com
*   **GitHub:** [zohaibmohd](https://github.com/zohaibmohd)

For questions or issues, feel free to [open an issue](https://github.com/zohaibmohd/marginfi-ai-chatbot/issues) or reach out via email.
