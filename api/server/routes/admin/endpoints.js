const express = require('express');
const { adminEndpointService } = require('@librechat/api');

const router = express.Router();

router.get('/stats', async (req, res) => {
  try {
    const stats = await adminEndpointService.getEndpointStats();
    res.status(200).json(stats);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching endpoint stats' });
  }
});

module.exports = router;
