const dotenv = require('dotenv');

dotenv.config();

function getEnv(name, fallback) {
  const value = process.env[name];
  if (value && value.trim().length > 0) return value;
  if (fallback !== undefined) return fallback;
  throw new Error(`Missing required environment variable: ${name}`);
}

module.exports = {
  discordToken: () => getEnv('DISCORD_BOT_TOKEN'),
  discordClientId: () => getEnv('DISCORD_CLIENT_ID'),
  discordGuildId: () => getEnv('DISCORD_GUILD_ID'),
  llmApiKey: () => getEnv('LLM_API_KEY'),
  llmApiBase: () => getEnv('LLM_API_BASE'),
  llmDefaultModel: () => getEnv('LLM_DEFAULT_MODEL', 'asi1-mini'),
};
