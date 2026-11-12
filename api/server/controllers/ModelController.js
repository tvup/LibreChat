const { createModelsService, adminModelOverrideService } = require('@librechat/api');
const {
  config,
  getAppConfig,
  loadDefaultModels,
  loadConfigModels,
  loadAsyncEndpoints,
} = require('~/server/services/Config');

module.exports = createModelsService({
  getAppConfig,
  loadDefaultModels,
  loadConfigModels,
  loadAsyncEndpoints,
  defaultEndpointsConfig: config,
  filterModels: adminModelOverrideService.filterModelsConfig,
});
