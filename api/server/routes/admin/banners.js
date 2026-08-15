const express = require('express');
const { adminBannerService } = require('@librechat/api');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const banners = await adminBannerService.listBanners();
    res.status(200).json(banners);
  } catch (error) {
    res.status(500).json({ message: 'Error listing banners' });
  }
});

router.post('/', async (req, res) => {
  try {
    const banner = await adminBannerService.createBanner(req.body);
    res.status(201).json(banner);
  } catch (error) {
    res.status(500).json({ message: 'Error creating banner' });
  }
});

router.put('/:bannerId', async (req, res) => {
  try {
    const updated = await adminBannerService.updateBanner(req.params.bannerId, req.body);
    if (!updated) {
      return res.status(404).json({ message: 'Banner not found' });
    }
    res.status(200).json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Error updating banner' });
  }
});

router.delete('/:bannerId', async (req, res) => {
  try {
    const result = await adminBannerService.deleteBanner(req.params.bannerId);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error deleting banner' });
  }
});

module.exports = router;
