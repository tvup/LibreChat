const express = require('express');
const { adminDashboardService } = require('@librechat/api');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const stats = await adminDashboardService.getDashboardStats();
    res.status(200).json(stats);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching dashboard stats' });
  }
});

module.exports = router;
