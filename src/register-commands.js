const { REST, Routes, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { discordToken, discordClientId, discordGuildId, llmApiKey, llmApiBase } = require('./config');
const { getAvailableModels, getModelChoices } = require('./llmModels');

/**
 * Build slash commands with the provided model choices
 * @param {Array<{name: string, value: string}>} modelChoices - Discord choice format
 * @returns {Object[]} Array of command JSON objects
 */
function buildCommands(modelChoices) {
  const ask = new SlashCommandBuilder()
    .setName('askllm')
    .setDescription('Ask a question to a selected LLM model')
    .addStringOption(option =>
      option
        .setName('model')
        .setDescription('Model to use')
        .setRequired(true)
        .addChoices(...modelChoices)
    )
    .addStringOption(option =>
      option
        .setName('question')
        .setDescription('Your question for the model')
        .setRequired(true)
    );

  const summarize = new SlashCommandBuilder()
    .setName('summarize')
    .setDescription('Summarize recent messages in this channel')
    .addIntegerOption(option =>
      option
        .setName('limit')
        .setDescription('How many recent messages to include (10-1000)')
        .setRequired(false)
        .setMinValue(10)
        .setMaxValue(1000)
    )
    .addBooleanOption(option =>
      option
        .setName('include_bots')
        .setDescription('Include messages from bots')
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName('model')
        .setDescription('Model to use (optional)')
        .setRequired(false)
        .addChoices(...modelChoices)
    );

  const refreshModels = new SlashCommandBuilder()
    .setName('refresh_models')
    .setDescription('Refresh the available models list from the API (admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

  return [ask.toJSON(), summarize.toJSON(), refreshModels.toJSON()];
}

/**
 * Register slash commands with Discord
 * @param {boolean} forceRefreshModels - Force refresh models from API
 * @returns {Promise<string[]>} The list of models that were registered
 */
async function register(forceRefreshModels = false) {
  const token = discordToken;
  const clientId = discordClientId;
  const guildId = discordGuildId;
  const apiKey = llmApiKey;
  const apiBase = llmApiBase;

  // Fetch available models from API
  const models = await getAvailableModels(apiBase, apiKey, forceRefreshModels);
  const modelChoices = getModelChoices(models);
  
  const rest = new REST({ version: '10' }).setToken(token);
  const commands = buildCommands(modelChoices);

  try {
    await rest.put(
      Routes.applicationGuildCommands(clientId, guildId),
      { body: commands }
    );
    console.log('Slash commands registered for guild:', guildId);
    console.log('Registered models:', models);
  } catch (err) {
    const code = err?.code || err?.rawError?.code;
    if (code === 50001) {
      console.warn('Missing Access for guild registration. Falling back to GLOBAL commands (may take up to 1 hour).');
      await rest.put(Routes.applicationCommands(clientId), { body: commands });
      console.log('Global commands registered.');
    } else {
      throw err;
    }
  }
  
  return models;
}

if (require.main === module) {
  register(true).catch((err) => {
    console.error('Failed to register commands', err?.response?.data || err);
    process.exit(1);
  });
}

module.exports = { register, buildCommands };
