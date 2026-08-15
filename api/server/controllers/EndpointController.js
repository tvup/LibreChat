const { EModelEndpoint } = require('librechat-data-provider');
const { getEndpointsConfig } = require('~/server/services/Config');
const { getModelsConfig } = require('~/server/controllers/ModelController');

const ENDPOINTS_WITHOUT_OWN_MODELS = new Set([EModelEndpoint.agents]);

async function endpointController(req, res) {
  const endpointsConfig = await getEndpointsConfig(req);
  const modelsConfig = await getModelsConfig(req);

  const filteredEndpoints = {};
  for (const [endpoint, config] of Object.entries(endpointsConfig)) {
    if (ENDPOINTS_WITHOUT_OWN_MODELS.has(endpoint)) {
      filteredEndpoints[endpoint] = config;
      continue;
    }
    const models = modelsConfig[endpoint];
    if (models && models.length > 0) {
      filteredEndpoints[endpoint] = config;
    }
  }

  res.send(JSON.stringify(filteredEndpoints));
}

module.exports = endpointController;
