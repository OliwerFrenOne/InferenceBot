const dotenv = require('dotenv');

dotenv.config();

function getEnv(name, fallback) {
  const value = process.env[name];
  if (value && value.trim().length > 0) return value;
  if (fallback !== undefined) return fallback;
  throw new Error(`Missing required environment variable: ${name}`);
}

// Load and validate all environment variables at startup
// This ensures we fail fast if any required config is missing
const config = {
  discordToken: getEnv('DISCORD_BOT_TOKEN'),
  discordClientId: getEnv('DISCORD_CLIENT_ID'),
  discordGuildId: getEnv('DISCORD_GUILD_ID'),
  llmApiKey: getEnv('LLM_API_KEY'),
  llmApiBase: getEnv('LLM_API_BASE'),
  llmDefaultModel: getEnv('LLM_DEFAULT_MODEL', 'asi1-mini'),
};

console.log('✓ All required environment variables loaded successfully');

module.exports = config;
