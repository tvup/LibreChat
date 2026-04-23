const express = require('express');
const { adminFileService } = require('@librechat/api');

const router = express.Router();

router.get('/stats', async (req, res) => {
  try {
    const stats = await adminFileService.getFileStats();
    res.status(200).json(stats);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching file stats' });
  }
});

router.get('/', async (req, res) => {
  try {
    const params = {
      search: req.query.search,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
      cursor: req.query.cursor,
      userId: req.query.userId,
    };
    const result = await adminFileService.listFiles(params);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: 'Error listing files' });
  }
});

router.delete('/:fileId', async (req, res) => {
  try {
    const result = await adminFileService.deleteFile(req.params.fileId);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error deleting file' });
  }
});

module.exports = router;
