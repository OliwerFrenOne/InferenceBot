const { REST, Routes, SlashCommandBuilder } = require('discord.js');
const { discordToken, discordClientId, discordGuildId } = require('./config');

const MODEL_CHOICES = [
  'asi1-mini',
  'google/gemma-3-27b-it',
  'openai/gpt-oss-20b',
  'meta-llama/llama-3.3-70b-instruct',
  'mistralai/mistral-nemo',
  'qwen/qwen3-32b',
  'z-ai/glm-4.5-air',
];

function buildCommands() {
  const ask = new SlashCommandBuilder()
    .setName('askllm')
    .setDescription('Ask a question to a selected LLM model')
    .addStringOption(option =>
      option
        .setName('model')
        .setDescription('Model to use')
        .setRequired(true)
        .addChoices(...MODEL_CHOICES.map((m) => ({ name: m, value: m })))
    )
    .addStringOption(option =>
      option
        .setName('question')
        .setDescription('Your question for the model')
        .setRequired(true)
    );

  return [ask.toJSON()];
}

async function register() {
  const rest = new REST({ version: '10' }).setToken(discordToken());
  const clientId = discordClientId();
  const guildId = discordGuildId();

  const commands = buildCommands();

  try {
    await rest.put(
      Routes.applicationGuildCommands(clientId, guildId),
      { body: commands }
    );
    console.log('Slash commands registered for guild:', guildId);
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
}

if (require.main === module) {
  register().catch((err) => {
    console.error('Failed to register commands', err?.response?.data || err);
    process.exit(1);
  });
}

module.exports = { register };
