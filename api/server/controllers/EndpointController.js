const { getEndpointsConfig } = require('~/server/services/Config');
const { getModelsConfig } = require('~/server/controllers/ModelController');

async function endpointController(req, res) {
  const endpointsConfig = await getEndpointsConfig(req);
  const modelsConfig = await getModelsConfig(req);

  const filteredEndpoints = {};
  for (const [endpoint, config] of Object.entries(endpointsConfig)) {
    const models = modelsConfig[endpoint];
    if (models && models.length > 0) {
      filteredEndpoints[endpoint] = config;
    }
  }

  res.send(JSON.stringify(filteredEndpoints));
}

module.exports = endpointController;
