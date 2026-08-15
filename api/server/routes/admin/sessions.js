const express = require('express');
const { adminSessionService } = require('@librechat/api');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const sessions = await adminSessionService.getActiveSessions();
    res.status(200).json(sessions);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching active sessions' });
  }
});

router.delete('/:userId', async (req, res) => {
  try {
    const result = await adminSessionService.revokeUserSessions(req.params.userId);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error revoking sessions' });
  }
});

module.exports = router;
