const express = require('express');
const { logger } = require('@librechat/data-schemas');
const { adminDashboardService } = require('@librechat/api');
const getLogStores = require('~/cache/getLogStores');
const { getActiveUserBans } = require('./banStatus');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const stats = await adminDashboardService.getDashboardStats(getLogStores);
    // Servicen kalder banLogs.size(), som Keyv ikke har — derfor altid 0. Tæl selv.
    try {
      stats.totalBannedUsers = (await getActiveUserBans()).size;
    } catch (error) {
      logger.warn('[admin/dashboard] Could not count banned users:', error);
    }
    res.status(200).json(stats);
  } catch {
    res.status(500).json({ message: 'Error fetching dashboard stats' });
  }
});

module.exports = router;
