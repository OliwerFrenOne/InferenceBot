## InferenceBot

Discord bot that queries a serverless inference API with a chosen LLM.

### Prerequisites
- Node.js 18+
- Discord application and bot token
- Guild (server) where you can register slash commands

### Setup
1. Clone and install
```bash
npm install
```

2. Configure environment
Copy `.env.example` to `.env` and fill values:
```
DISCORD_BOT_TOKEN=your-discord-bot-token
DISCORD_CLIENT_ID=your-app-client-id
DISCORD_GUILD_ID=your-guild-id

LLM_API_KEY=your-llm-api-key
LLM_API_BASE=https://api.your-inference-platform.com/v1
```

3. Register slash commands (guild-scoped)
```bash
npm run register
```

4. Start the bot
```bash
npm start
```

### Usage
- In your Discord server, use `/askllm`.
- Choose a model and provide the question.
- The bot posts "Thinking…", then replaces it with the model used and the answer.

### Notes
- The LLM API is assumed OpenAI-compatible at `POST {LLM_API_BASE}/chat/completions` with `Authorization: Bearer` header.
- Increase timeouts or add retries in `src/llmClient.js` if needed.
