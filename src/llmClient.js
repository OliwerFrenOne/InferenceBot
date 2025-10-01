const axios = require('axios');
const { llmApiKey, llmApiBase } = require('./config');

/**
 * Sends an OpenAI-compatible chat completion request to the configured LLM API.
 * @param {Object} params
 * @param {string} params.model
 * @param {Array<{role: 'system'|'user'|'assistant', content: string}>} params.messages
 * @returns {Promise<string>} assistant message content
 */
async function createChatCompletion({ model, messages }) {
  const baseUrl = llmApiBase();
  const apiKey = llmApiKey();

  const url = baseUrl.replace(/\/$/, '') + '/chat/completions';

  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

  const body = {
    model,
    messages,
  };

  const response = await axios.post(url, body, { headers, timeout: 120000 });
  const data = response.data || {};

  // OpenAI-compatible preferred
  const content = data?.choices?.[0]?.message?.content
    || data?.choices?.[0]?.text
    || data?.output_text
    || data?.message
    || '';

  if (!content) {
    throw new Error('Empty response from LLM API');
  }

  return typeof content === 'string' ? content : JSON.stringify(content);
}

module.exports = { createChatCompletion };
