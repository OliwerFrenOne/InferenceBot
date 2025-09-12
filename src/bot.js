const { Client, GatewayIntentBits, Partials, Events } = require('discord.js');
const { discordToken, llmDefaultModel } = require('./config');
const { createChatCompletion } = require('./llmClient');

function formatFinalMessage({ askedBy, question, model, answer }) {
  return `**Asked by:** ${askedBy}\n**Question:** ${question}\n**Model:** ${model}\n**Answer:**\n${answer}`;
}

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

  // /askllm command
  if (interaction.commandName === 'askllm') {
    const model = interaction.options.getString('model', true);
    const question = interaction.options.getString('question', true);
    const userId = interaction.user?.id;
    const userTag = interaction.user?.tag || interaction.user?.username || String(userId || 'unknown');
    const userMention = userId ? `<@${userId}>` : userTag;

    // Acknowledge the interaction without creating a visible reply chain
    await interaction.deferReply({ flags: 64 }).catch(() => {});

    try {
      const answer = await createChatCompletion({
        model,
        messages: [
          { role: 'system', content: 'You are a helpful assistant answering concisely.' },
          { role: 'user', content: question },
        ],
      });

      console.log('LLM answer', { user: userTag, model, question });

      // Prefer a normal channel post; if we don't have permission, fall back to interaction follow-up
      const final = formatFinalMessage({ askedBy: userMention, question, model, answer });
      try {
        await interaction.deleteReply();
      } catch (_) {}
      try {
        await interaction.channel?.send(final);
      } catch (sendErr) {
        const code = sendErr?.code || sendErr?.rawError?.code || sendErr?.status;
        if (code === 50001 || code === 50013 || code === 403) {
          // Avoid posting a reply in-channel; DM the user instead
          try {
            await interaction.user?.send(final);
            try { await interaction.editReply({ content: 'I do not have permission to post in that channel. I have sent you a DM instead.', flags: 64 }); } catch (_) {}
          } catch (_) {
            // As a last resort, fall back to a follow-up
            try { await interaction.followUp(final); } catch { await interaction.editReply(final); }
          }
        } else {
          throw sendErr;
        }
      }
    } catch (err) {
      console.error('LLM error', { user: userTag, model, question, error: err?.response?.data || err });

      try {
        await interaction.editReply('Sorry, something went wrong while fetching the answer.');
      } catch (_) {}
    }
    return;
  }

  // /summarize command
  if (interaction.commandName === 'summarize') {
    const requestedLimit = interaction.options.getInteger('limit') || 200;
    const includeBots = interaction.options.getBoolean('include_bots') || false;
    const explicitModel = interaction.options.getString('model') || null;
    const model = explicitModel || llmDefaultModel();
    const userId = interaction.user?.id;
    const userTag = interaction.user?.tag || interaction.user?.username || String(userId || 'unknown');
    const userMention = userId ? `<@${userId}>` : userTag;

    const limit = Math.max(10, Math.min(1000, requestedLimit));
    await interaction.deferReply({ flags: 64 }).catch(() => {});

    try {
      // Fetch and accumulate recent messages
      const collected = [];
      let lastId = undefined;
      while (collected.length < limit) {
        const remaining = Math.min(100, limit - collected.length);
        const batch = await interaction.channel.messages.fetch({ limit: remaining, before: lastId });
        if (batch.size === 0) break;
        for (const [, msg] of batch) {
          if (!includeBots && msg.author?.bot) continue;
          const content = (msg.content || '').trim();
          if (!content) continue;
          collected.push(msg);
        }
        lastId = batch.last()?.id;
        if (!lastId) break;
      }

      // Sort chronologically
      collected.sort((a, b) => a.createdTimestamp - b.createdTimestamp);

      const plain = collected.map((m) => {
        const author = m.author?.tag || m.author?.username || m.author?.id || 'unknown';
        const content = (m.content || '').replace(/\s+/g, ' ').trim();
        return `${author}: ${content}`.slice(0, 2000);
      }).filter(Boolean);

      if (plain.length === 0) {
        await interaction.editReply('No readable messages found to summarize.');
        return;
      }

      const prompt = [
        'Summarize the following Discord channel conversation succinctly with bullet points and key decisions.',
        'Then provide 3 action items if applicable. Keep it under 200 words.',
        '',
        plain.join('\n')
      ].join('\n');

      const answer = await createChatCompletion({
        model,
        messages: [
          { role: 'system', content: 'You are a helpful assistant that summarizes discussions clearly and concisely.' },
          { role: 'user', content: prompt },
        ],
      });

      const final = formatFinalMessage({ askedBy: userMention, question: `Summarize last ${plain.length} messages`, model, answer });
      try { await interaction.deleteReply(); } catch (_) {}
      try { await interaction.channel?.send(final); }
      catch (sendErr) {
        const code = sendErr?.code || sendErr?.rawError?.code || sendErr?.status;
        if (code === 50001 || code === 50013 || code === 403) {
          try { await interaction.user?.send(final); try { await interaction.editReply({ content: 'I DMed you the summary (no permission to post here).', flags: 64 }); } catch (_) {} } catch (_) { try { await interaction.followUp(final); } catch { await interaction.editReply(final); } }
        } else {
          throw sendErr;
        }
      }
    } catch (err) {
      console.error('Summarize error', err?.response?.data || err);
      try { await interaction.editReply('Sorry, I could not summarize this channel.'); } catch (_) {}
    }
    return;
  }
});

// Respond when the bot is mentioned in a guild text message with a question
client.on(Events.MessageCreate, async (message) => {
  try {
    // Ignore bot's own messages and DMs
    if (message.author?.bot) return;
    if (!message.guild) return;

    const botId = client.user?.id;
    if (!botId) return;

    const isMentioningBot = message.mentions.users.has(botId);
    if (!isMentioningBot) return;

    const rawContent = typeof message.content === 'string' ? message.content : '';
    const question = rawContent.replace(/<@!?\d+>/g, '').trim();
    if (!question) {
      // If we can't read content, we likely lack the Message Content intent at the app level
      try {
        await message.reply('I can\'t read the question text. Please include your question after the mention, or enable Message Content Intent for the bot.');
      } catch (_) {}
      return;
    }

    const authorId = message.author?.id;
    const userTag = message.author?.tag || message.author?.username || String(authorId || 'unknown');
    const userMention = authorId ? `<@${authorId}>` : userTag;
    const model = llmDefaultModel();
    let thinkingMsg = null;
    try {
      thinkingMsg = await message.channel.send('Thinking…');
    } catch (_) {}

    const answer = await createChatCompletion({
      model,
      messages: [
        { role: 'system', content: 'You are a helpful assistant answering concisely.' },
        { role: 'user', content: question },
      ],
    });

    console.log('LLM answer (mention)', { user: userTag, model, question });

    const final = formatFinalMessage({ askedBy: userMention, question, model, answer });
    try {
      if (thinkingMsg) await thinkingMsg.delete();
    } catch (_) {}
    try {
      await message.channel.send(final);
    } catch (sendErr) {
      const code = sendErr?.code || sendErr?.rawError?.code || sendErr?.status;
      if (code === 50001 || code === 50013 || code === 403) {
        try { await message.author.send(final); } catch (_) {}
      } else {
        throw sendErr;
      }
    }
  } catch (err) {
    console.error('LLM error (mention)', { code: err?.code || err?.rawError?.code || err?.status, error: err?.response?.data || err });
  }
});

client.login(discordToken());
