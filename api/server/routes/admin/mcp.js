const express = require('express');
const { adminMcpService } = require('@librechat/api');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const servers = await adminMcpService.listMCPServers();
    res.status(200).json(servers);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching MCP servers' });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const stats = await adminMcpService.getMCPServerStats();
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
