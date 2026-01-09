const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Cache file for models (persists across restarts)
const CACHE_FILE = path.join(__dirname, '..', '.models-cache.json');

// In-memory cache
let cachedModels = null;

/**
 * Fetch available models from the LLM API
 * @param {string} apiBase - The base URL of the LLM API
 * @param {string} apiKey - The API key for authentication
 * @returns {Promise<string[]>} Array of model IDs
 */
async function fetchModelsFromAPI(apiBase, apiKey) {
  const url = apiBase.replace(/\/$/, '') + '/models';
  
  const response = await axios.get(url, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    timeout: 30000
  });
  
  const models = response.data.data || response.data || [];
  return models.map(m => m.id || m.name || m).filter(Boolean);
}

/**
 * Load models from cache file
 * @returns {string[]|null} Cached models or null if not found
 */
function loadModelsFromCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const data = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
      if (data.models && Array.isArray(data.models) && data.models.length > 0) {
        console.log(`Loaded ${data.models.length} models from cache`);
        return data.models;
      }
    }
  } catch (err) {
    console.warn('Failed to load models cache:', err.message);
  }
  return null;
}

/**
 * Save models to cache file
 * @param {string[]} models - Array of model IDs to cache
 */
function saveModelsToCache(models) {
  try {
    const data = {
      models,
      updatedAt: new Date().toISOString()
    };
    fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2));
    console.log(`Saved ${models.length} models to cache`);
  } catch (err) {
    console.warn('Failed to save models cache:', err.message);
  }
}

/**
 * Get available models (from cache or API)
 * @param {string} apiBase - The base URL of the LLM API
 * @param {string} apiKey - The API key for authentication
 * @param {boolean} forceRefresh - Force refresh from API
 * @returns {Promise<string[]>} Array of model IDs
 */
async function getAvailableModels(apiBase, apiKey, forceRefresh = false) {
  // Return in-memory cache if available and not forcing refresh
  if (cachedModels && !forceRefresh) {
    return cachedModels;
  }
  
  // Try to load from file cache first (if not forcing refresh)
  if (!forceRefresh) {
    const fileCached = loadModelsFromCache();
    if (fileCached) {
      cachedModels = fileCached;
      return cachedModels;
    }
  }
  
  // Fetch from API
  try {
    console.log('Fetching models from API...');
    const models = await fetchModelsFromAPI(apiBase, apiKey);
    
    if (models.length > 0) {
      cachedModels = models;
      saveModelsToCache(models);
      console.log(`Fetched ${models.length} models from API:`, models);
      return models;
    }
  } catch (err) {
    console.error('Failed to fetch models from API:', err.message);
  }
  
  // Fallback to hardcoded defaults if API fails
  const defaults = [
    'asi1-mini',
    'google/gemma-3-27b-it',
    'openai/gpt-oss-20b',
    'meta-llama/llama-3.3-70b-instruct',
    'mistralai/mistral-nemo',
    'qwen/qwen3-32b',
    'z-ai/glm-4.5-air',
  ];
  
  console.warn('Using fallback model list');
  cachedModels = defaults;
  return defaults;
}

/**
 * Get models for Discord command choices (max 25)
 * Discord limits choices to 25, so we may need to truncate
 * @param {string[]} models - Full list of models
 * @returns {Array<{name: string, value: string}>} Discord choice format
 */
function getModelChoices(models) {
  // Discord allows max 25 choices
  const maxChoices = 25;
  const limitedModels = models.slice(0, maxChoices);
  
  if (models.length > maxChoices) {
    console.warn(`Model list truncated from ${models.length} to ${maxChoices} (Discord limit)`);
  }
  
  return limitedModels.map(m => ({ name: m, value: m }));
}

/**
 * Clear the in-memory cache
 */
function clearCache() {
  cachedModels = null;
}

module.exports = {
  fetchModelsFromAPI,
  getAvailableModels,
  getModelChoices,
  clearCache,
  loadModelsFromCache,
  saveModelsToCache
};

