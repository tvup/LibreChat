const express = require('express');
const { adminSocialMappingService } = require('@librechat/api');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const mappings = await adminSocialMappingService.getAllMappings();
    res.status(200).json(mappings);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching social mappings' });
  }
});

router.get('/user/:userId', async (req, res) => {
  try {
    const mappings = await adminSocialMappingService.getMappingsForUser(req.params.userId);
    res.status(200).json(mappings);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching user mappings' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { socialEmail, provider, targetUserId } = req.body;
    if (!socialEmail || !provider || !targetUserId) {
      return res.status(400).json({ message: 'socialEmail, provider, and targetUserId are required' });
    }
    const mapping = await adminSocialMappingService.createMapping(
      socialEmail,
      provider,
      targetUserId,
      req.user._id.toString(),
    );
    res.status(201).json(mapping);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'A mapping for this email and provider already exists' });
    }
    res.status(500).json({ message: error.message || 'Error creating social mapping' });
  }
});

router.delete('/:mappingId', async (req, res) => {
  try {
    const result = await adminSocialMappingService.deleteMapping(req.params.mappingId);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error deleting social mapping' });
  }
});

module.exports = router;
