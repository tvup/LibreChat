const express = require('express');
const { adminMcpService } = require('@librechat/api');
const { getAppConfig } = require('~/server/services/Config');

const router = express.Router();

async function getYamlMcpConfig(req) {
  const appConfig =
    req.config ?? (await getAppConfig({ role: req.user?.role, tenantId: req.user?.tenantId }));
  return appConfig?.mcpConfig ?? null;
}

router.get('/', async (req, res) => {
  try {
    const yamlConfig = await getYamlMcpConfig(req);
    const servers = await adminMcpService.listMCPServers(yamlConfig);
    res.status(200).json(servers);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching MCP servers' });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const yamlConfig = await getYamlMcpConfig(req);
    const stats = await adminMcpService.getMCPServerStats(yamlConfig);
    res.status(200).json(stats);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching MCP stats' });
  }
});

router.post('/:serverName/reinitialize', async (req, res) => {
  try {
    const { serverName } = req.params;
    res.status(200).json({ message: `Reinitialize request sent for ${serverName}` });
  } catch (error) {
    res.status(500).json({ message: 'Error reinitializing MCP server' });
  }
});

module.exports = router;
