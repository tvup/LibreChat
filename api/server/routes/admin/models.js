const express = require('express');
const { adminModelOverrideService } = require('@librechat/api');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { loadModels } = require('~/server/controllers/ModelController');

    const allModels = await loadModels(req);

    const overrides = await adminModelOverrideService.getModelOverrides();
    const disabledMap = {};
    for (const override of overrides) {
      disabledMap[override.endpoint] = override.disabledModels;
    }

    const result = {};
    for (const [endpoint, models] of Object.entries(allModels)) {
      const disabled = new Set(disabledMap[endpoint] || []);
      result[endpoint] = models.map((model) => ({
        model,
        enabled: !disabled.has(model),
      }));
    }

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching models config' });
  }
});

router.post('/toggle', async (req, res) => {
  try {
    const { endpoint, model, disabled } = req.body;
    if (!endpoint || !model || typeof disabled !== 'boolean') {
      return res.status(400).json({ message: 'endpoint, model, and disabled (boolean) are required' });
    }

    const disabledModels = await adminModelOverrideService.toggleModel(endpoint, model, disabled);

    const { getLogStores } = require('~/cache');
    const { CacheKeys } = require('librechat-data-provider');
    const modelsCache = getLogStores(CacheKeys.CONFIG_STORE);
    await modelsCache.delete(CacheKeys.MODELS_CONFIG);

    res.status(200).json({ endpoint, disabledModels });
  } catch (error) {
    res.status(500).json({ message: 'Error toggling model' });
  }
});

router.post('/bulk', async (req, res) => {
  try {
    const { endpoint, disabledModels } = req.body;
    if (!endpoint || !Array.isArray(disabledModels)) {
      return res.status(400).json({ message: 'endpoint and disabledModels array are required' });
    }

    await adminModelOverrideService.setDisabledModels(endpoint, disabledModels);

    const { getLogStores } = require('~/cache');
    const { CacheKeys } = require('librechat-data-provider');
    const modelsCache = getLogStores(CacheKeys.CONFIG_STORE);
    await modelsCache.delete(CacheKeys.MODELS_CONFIG);

    res.status(200).json({ endpoint, disabledModels });
  } catch (error) {
    res.status(500).json({ message: 'Error updating model overrides' });
  }
});

module.exports = router;
