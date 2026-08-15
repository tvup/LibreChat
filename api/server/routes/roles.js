const express = require('express');
const { logger, SystemCapabilities } = require('@librechat/data-schemas');
const { roleDefaults, SystemRoles } = require('librechat-data-provider');
const { getRoleByName } = require('~/models');
const { hasCapability } = require('~/server/middleware/roles/capabilities');
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
    const isOwnRole = req.user?.role === roleName;
    const isDefaultRole = Object.hasOwn(roleDefaults, roleName);
    /** READ_ROLES only gates reading other roles; own role and non-admin default roles skip the probe */
    const requiresReadRoles = !isOwnRole && (roleName === SystemRoles.ADMIN || !isDefaultRole);
    if (requiresReadRoles) {
      let hasReadRoles = false;
      try {
        hasReadRoles = await hasCapability(
          {
            id: req.user?.id ?? req.user?._id?.toString() ?? '',
            role: req.user?.role ?? '',
            tenantId: req.user?.tenantId,
            idOnTheSource: req.user?.idOnTheSource ?? null,
          },
          SystemCapabilities.READ_ROLES,
        );
      } catch (err) {
        logger.warn(`[GET /roles/:roleName] capability check failed: ${err.message}`);
      }
      if (!hasReadRoles) {
        return res.status(403).send({ message: 'Unauthorized' });
      }
    }

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
