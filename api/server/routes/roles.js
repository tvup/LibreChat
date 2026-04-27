const express = require('express');
const { logger } = require('@librechat/data-schemas');
const { roleDefaults } = require('librechat-data-provider');
const { getRoleByName } = require('~/models');
const { requireJwtAuth } = require('~/server/middleware');

/**
 * Read-only role-info-route. Erstatter den gamle bredere /api/roles-router der
 * også havde syv PUT-endpoints til at opdatere permissions; alle writes går
 * nu via upstream's capability-gated /api/admin/roles/:name/permissions.
 *
 * Hovedklientens AuthContext kalder GET /api/roles/:name for at hente USER-
 * og ADMIN-rollens permissions så den kan vise/skjule chat-features korrekt
 * — det skal være tilgængeligt for ALLE authenticated users (ikke kun
 * admins), så det kan ikke leve under /api/admin/roles.
 */
const router = express.Router();
router.use(requireJwtAuth);

router.get('/:roleName', async (req, res) => {
  const { roleName: paramRoleName } = req.params;
  try {
    const roleName = paramRoleName.toUpperCase();
    const role = await getRoleByName(roleName, '-_id -__v');
    if (!role) {
      const defaultRole = roleDefaults[roleName];
      if (defaultRole) {
        return res.status(200).json(defaultRole);
      }
      return res.status(404).json({ message: 'Role not found' });
    }
    return res.status(200).json(role);
  } catch (error) {
    logger.error(`Error fetching role ${paramRoleName}:`, error);
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
