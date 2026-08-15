const express = require('express');
const { adminTransactionService } = require('@librechat/api');

const router = express.Router();

router.get('/stats', async (req, res) => {
  try {
    const stats = await adminTransactionService.getTokenStats();
    res.status(200).json(stats);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching token stats' });
  }
});

module.exports = router;
