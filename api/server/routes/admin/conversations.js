const express = require('express');
const { adminConversationService } = require('@librechat/api');

const router = express.Router();

router.get('/stats', async (req, res) => {
  try {
    const stats = await adminConversationService.getConversationStats();
    res.status(200).json(stats);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching conversation stats' });
  }
});

router.get('/', async (req, res) => {
  try {
    const params = {
      search: req.query.search,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
      cursor: req.query.cursor,
      userId: req.query.userId,
      contentSearch: req.query.contentSearch,
    };
    const result = await adminConversationService.listConversations(params);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: 'Error listing conversations' });
  }
});

router.delete('/:conversationId', async (req, res) => {
  try {
    const result = await adminConversationService.deleteConversation(req.params.conversationId);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error deleting conversation' });
  }
});

module.exports = router;
