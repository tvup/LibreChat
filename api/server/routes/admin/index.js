const express = require('express');
const { requireAdmin } = require('@librechat/api');
const middleware = require('~/server/middleware');

const router = express.Router();

// Auth routes (some don't require admin, e.g. login)
router.use('/', require('./auth'));

// Return from impersonation — requires JWT but NOT admin (since the impersonated user isn't admin)
router.post('/impersonate/return', middleware.requireJwtAuth, async (req, res) => {
  try {
    const adminUserId = req.cookies?.impersonate_admin_id;
    if (!adminUserId) {
      return res.status(400).json({ message: 'No active impersonation session' });
    }

    const User = require('mongoose').models.User;
    const { SystemRoles } = require('librechat-data-provider');
    const adminUser = await User.findById(adminUserId).lean();
    if (!adminUser || adminUser.role !== SystemRoles.ADMIN) {
      return res.status(403).json({ message: 'Invalid admin user' });
    }

    const { setAuthTokens } = require('~/server/services/AuthService');
    const token = await setAuthTokens(adminUserId, res);

    res.clearCookie('impersonate_admin_id');
    res.status(200).json({ token });
  } catch (error) {
    res.status(500).json({ message: 'Error returning from impersonation' });
  }
});

// All routes below require JWT auth + admin role
router.use(middleware.requireJwtAuth);
router.use(requireAdmin);

router.use('/dashboard', require('./dashboard'));
router.use('/users', require('./users'));
router.use('/banners', require('./banners'));
router.use('/conversations', require('./conversations'));
router.use('/files', require('./files'));
router.use('/sessions', require('./sessions'));
router.use('/logs', require('./logs'));
router.use('/endpoints', require('./endpoints'));
router.use('/mcp', require('./mcp'));
router.use('/transactions', require('./transactions'));
router.use('/social-mappings', require('./socialMappings'));
router.use('/models', require('./models'));
router.use('/roles', require('./roles'));
router.use('/config', require('./config'));
router.use('/grants', require('./grants'));
router.use('/groups', require('./groups'));
router.use('/skills', require('./skills'));

module.exports = router;
