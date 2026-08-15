const { logger } = require('@librechat/data-schemas');
const { CacheKeys } = require('librechat-data-provider');
const { loadDefaultModels, loadConfigModels } = require('~/server/services/Config');
const getLogStores = require('~/cache/getLogStores');

/**
 * Applies admin model overrides to filter out disabled models.
 * @param {TModelsConfig} modelConfig - The unfiltered models config.
 * @returns {Promise<TModelsConfig>} The filtered models config.
 */
async function applyModelOverrides(modelConfig) {
  try {
    const { adminModelOverrideService } = require('@librechat/api');
    const disabledMap = await adminModelOverrideService.getDisabledModelsMap();

    const filteredConfig = {};
    for (const [endpoint, models] of Object.entries(modelConfig)) {
      const disabled = disabledMap[endpoint];
      if (disabled && disabled.size > 0) {
        filteredConfig[endpoint] = models.filter((model) => !disabled.has(model));
      } else {
        filteredConfig[endpoint] = models;
      }
    }

    return filteredConfig;
  } catch (error) {
    logger.warn('[applyModelOverrides] Failed to apply overrides, returning unfiltered:', error.message);
    return modelConfig;
  }
}

/**
 * @param {ServerRequest} req
 * @returns {Promise<TModelsConfig>} The filtered models config.
 */
const getModelsConfig = async (req) => {
  try {
    const cache = getLogStores(CacheKeys.CONFIG_STORE);
    let modelsConfig = await cache.get(CacheKeys.MODELS_CONFIG);
    if (!modelsConfig) {
      modelsConfig = await loadModels(req);
    }

    return applyModelOverrides(modelsConfig);
  } catch (error) {
    logger.error('Error fetching default models:', error.message);
    return {};
  }
};

/**
 * Loads the raw models from the config (without admin overrides).
 * @param {ServerRequest} req - The Express request object.
 * @returns {Promise<TModelsConfig>} The raw models config.
 */
async function loadModels(req) {
  const [defaultModelsConfig, customModelsConfig] = await Promise.all([
    loadDefaultModels(req),
    loadConfigModels(req),
  ]);
  return { ...defaultModelsConfig, ...customModelsConfig };
}

async function modelController(req, res) {
  try {
    const modelConfig = await loadModels(req);
    const filteredConfig = await applyModelOverrides(modelConfig);
    res.send(filteredConfig);
  } catch (error) {
    logger.error('Error fetching models:', error);
    res.status(500).send({ error: error.message });
  }
}

module.exports = { modelController, loadModels, getModelsConfig };
