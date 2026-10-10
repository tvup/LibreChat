const express = require('express');
const { adminDashboardService } = require('@librechat/api');
const getLogStores = require('~/cache/getLogStores');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const stats = await adminDashboardService.getDashboardStats(getLogStores);
    res.status(200).json(stats);
  } catch {
    res.status(500).json({ message: 'Error fetching dashboard stats' });
  }
});

module.exports = router;
