const { Client, GatewayIntentBits, Partials, Events } = require('discord.js');
const { discordToken } = require('./config');
const { createChatCompletion } = require('./llmClient');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

client.once(Events.ClientReady, (c) => {
  console.log(`Bot logged in as ${c.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== 'askllm') return;

  const model = interaction.options.getString('model', true);
  const question = interaction.options.getString('question', true);

  // Send immediate feedback
  await interaction.deferReply();
  await interaction.editReply('Thinking…');

  try {
    const answer = await createChatCompletion({
      model,
      messages: [
        { role: 'system', content: 'You are a helpful assistant answering concisely.' },
        { role: 'user', content: question },
      ],
    });

    try {
      await interaction.deleteReply();
    } catch (_) {
      // ignore deletion errors
    }

    const final = `Model: ${model}\n\n${answer}`;
    await interaction.followUp(final);
  } catch (err) {
    console.error('LLM error', err?.response?.data || err);

    try {
      await interaction.editReply('Sorry, something went wrong while fetching the answer.');
    } catch (_) {
      // ignore
    }
  }
});

client.login(discordToken());
