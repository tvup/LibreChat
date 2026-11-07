const express = require('express');
const crypto = require('crypto');
const mongoose = require('mongoose');
const {
  adminUserService,
  GenerationJobManager,
  openCheckpointDeletion,
  deleteAllSharedLinksWithCleanup,
  createErasureResolver,
  createAdminUsersHandlers,
  revokeUserCodeEnvironmentWorkers,
} = require('@librechat/api');
const { SystemCapabilities, runAsSystem, tenantStorage } = require('@librechat/data-schemas');
const { requireCapability } = require('~/server/middleware/roles/capabilities');
const { requireJwtAuth } = require('~/server/middleware');
const {
  drainAgentTriggerDeliveriesForUser,
  prepareAgentTriggerUserPurge,
  cancelAgentTriggerUserPurge,
  purgeAgentTriggerDeliveriesForUser,
} = require('~/server/services/Agents/triggers');
const { processDeleteRequest } = require('~/server/services/Files/process');
const { invalidateCachedTools } = require('~/server/services/Config/getCachedTools');
const { getMCPManager, getMCPServersRegistry } = require('~/config');
const { maybeUninstallOAuthMCP } = require('~/server/services/MCP/oauthCleanup');
const subagentThreadTaskStore = require('~/server/services/Endpoints/agents/subagentThreadStore');
const {
  quiesceUserSchedules,
  restoreUserSchedulesFromDeletion,
} = require('~/server/services/Schedules');
const db = require('~/models');
const {
  parseBanDuration,
  isValidUserId,
  getActiveUserBans,
  banUser,
  unbanUser,
} = require('./banStatus');
const { getAppConfig, invalidateCodeEnvironmentConfigCache } = require('~/server/services/Config');

const router = express.Router();

const resolveErasure = createErasureResolver({
  withTenant: (tenantId, operation) =>
    tenantId ? tenantStorage.run({ tenantId }, operation) : runAsSystem(operation),
  db,
  getAppConfig,
  getMCPManager,
  processDeleteRequest,
  invalidateCachedTools,
  mcpOAuth: {
    getRegistry: getMCPServersRegistry,
    getUserPrincipals: db.getUserPrincipals,
    uninstallOAuthMCP: maybeUninstallOAuthMCP,
  },
  openCheckpointDeletion,
  deleteSharedLinks: (userId) => deleteAllSharedLinksWithCleanup(userId, { awaitCleanup: true }),
});

const requireAdminAccess = requireCapability(SystemCapabilities.ACCESS_ADMIN);
const requireReadUsers = requireCapability(SystemCapabilities.READ_USERS);

/**
 * Upstream's listUsers/searchUsers — bruger offset-pagination og returnerer
 * { users, total, limit, offset } istedet for forken's tidligere cursor-shape.
 * Forken's egne write-endpoints (ban/balance/impersonate/...) ligger fortsat
 * herunder.
 */
const upstreamHandlers = createAdminUsersHandlers({
  findUsers: db.findUsers,
  countUsers: db.countUsers,
  beginAgentTriggerUserDeletion: db.beginAgentTriggerUserDeletion,
  cancelAgentTriggerUserDeletion: db.cancelAgentTriggerUserDeletion,
  drainAgentTriggerDeliveriesForUser,
  prepareAgentTriggerUserPurge,
  cancelAgentTriggerUserPurge,
  purgeAgentTriggerDeliveriesForUser,
  revokeUserCodeEnvironmentWorkers: async (userId) =>
    revokeUserCodeEnvironmentWorkers({
      mongoose,
      userId,
      appConfig: await getAppConfig({ baseOnly: true }),
    }),
  deleteUserById: db.deleteUserById,
  deleteUserCodeEnvironments: db.deleteUserCodeEnvironments,
  invalidateCodeEnvironmentConfigCache,
  deleteConfig: db.deleteConfig,
  deleteAclEntries: db.deleteAclEntries,
  deletePasskeysByUser: db.deletePasskeysByUser,
  resolveErasure,
  cancelSubagentTasks: (userId, tenantId) =>
    subagentThreadTaskStore.cancelAndDrainForOwner(userId, tenantId),
  quiesceUserSchedules,
  restoreUserSchedulesFromDeletion,
  generationJobs: GenerationJobManager,
});

const SAFE_USER_FIELDS =
  '_id name username email role provider avatar emailVerified twoFactorEnabled createdAt updatedAt';

router.use(requireJwtAuth, requireAdminAccess);

router.get('/export/csv', async (req, res) => {
  try {
    const User = require('mongoose').models.User;
    const users = await User.find({}).select(SAFE_USER_FIELDS).lean().exec();

    const today = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=users-export-${today}.csv`);

    res.write('Name,Email,Role,Provider,Email Verified,2FA,Created\n');

    for (const user of users) {
      const name = (user.name || '').replace(/"/g, '""');
      const email = (user.email || '').replace(/"/g, '""');
      const role = user.role || '';
      const provider = user.provider || '';
      const emailVerified = user.emailVerified ? 'Yes' : 'No';
      const twoFA = user.twoFactorEnabled ? 'Yes' : 'No';
      const created = user.createdAt ? new Date(user.createdAt).toISOString().split('T')[0] : '';
      res.write(
        `"${name}","${email}","${role}","${provider}","${emailVerified}","${twoFA}","${created}"\n`,
      );
    }

    res.end();
  } catch {
    res.status(500).json({ message: 'Error exporting users' });
  }
});

/**
 * Aktive ban: GET /bans?ids=a,b,c → { bans: { [userId]: expiresAt (ISO) } }.
 * Uden `ids` returneres alle aktive bruger-ban.
 */
router.get('/bans', requireReadUsers, async (req, res) => {
  try {
    const ids =
      typeof req.query.ids === 'string' && req.query.ids.length > 0
        ? req.query.ids.split(',')
        : undefined;
    const active = await getActiveUserBans(ids);
    const bans = {};
    for (const [userId, expiresAt] of active) {
      bans[userId] = new Date(expiresAt).toISOString();
    }
    res.status(200).json({ bans });
  } catch {
    res.status(500).json({ message: 'Error fetching bans' });
  }
});

router.post('/bulk/ban', async (req, res) => {
  try {
    const { userIds } = req.body;
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ message: 'userIds array is required' });
    }
    if (!userIds.every(isValidUserId)) {
      return res.status(400).json({ message: 'Invalid user id' });
    }
    const durationMs = parseBanDuration(req.body);
    if (!durationMs) {
      return res.status(400).json({ message: 'Invalid ban duration' });
    }

    for (const userId of userIds) {
      await banUser(userId, durationMs);
    }

    res.status(200).json({ message: `${userIds.length} users banned successfully` });
  } catch {
    res.status(500).json({ message: 'Error banning users' });
  }
});

router.post('/bulk/delete', async (req, res) => {
  try {
    const { userIds } = req.body;
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ message: 'userIds array is required' });
    }

    const User = require('mongoose').models.User;
    const result = await User.deleteMany({ _id: { $in: userIds } });

    res.status(200).json({ message: `${result.deletedCount} users deleted successfully` });
  } catch {
    res.status(500).json({ message: 'Error deleting users' });
  }
});

router.post('/bulk/role', async (req, res) => {
  try {
    const { userIds, role } = req.body;
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ message: 'userIds array is required' });
    }
    if (!role || typeof role !== 'string') {
      return res.status(400).json({ message: 'Role is required' });
    }

    const User = require('mongoose').models.User;
    const result = await User.updateMany({ _id: { $in: userIds } }, { $set: { role } });

    res.status(200).json({ message: `${result.modifiedCount} users updated successfully` });
  } catch {
    res.status(500).json({ message: 'Error updating user roles' });
  }
});

router.post('/invite', async (req, res) => {
  try {
    const { email, role } = req.body;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ message: 'Email is required' });
    }

    const User = require('mongoose').models.User;
    const existing = await User.findOne({ email: email.toLowerCase() }).lean();
    if (existing) {
      return res.status(409).json({ message: 'A user with this email already exists' });
    }

    const tempPassword = crypto.randomBytes(12).toString('base64url');

    const bcrypt = require('bcryptjs');
    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync(tempPassword, salt);

    const created = await User.create({
      name: email.split('@')[0],
      email: email.toLowerCase(),
      password: hashedPassword,
      role: role || 'USER',
      provider: 'local',
      emailVerified: false,
    });

    const userObj = created.toObject();
    delete userObj.password;
    delete userObj.__v;

    res.status(201).json({
      message: 'User invited successfully',
      tempPassword,
      user: userObj,
    });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error inviting user' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ message: 'Email is required' });
    }

    if (!password || typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }

    const User = require('mongoose').models.User;
    const existing = await User.findOne({ email: email.toLowerCase() }).lean();
    if (existing) {
      return res.status(409).json({ message: 'A user with this email already exists' });
    }

    const bcrypt = require('bcryptjs');
    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync(password, salt);

    const created = await User.create({
      name: name || email.split('@')[0],
      email: email.toLowerCase(),
      password: hashedPassword,
      role: role || 'USER',
      provider: 'local',
      emailVerified: false,
    });

    const userObj = created.toObject();
    delete userObj.password;
    delete userObj.__v;

    res.status(201).json(userObj);
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error creating user' });
  }
});

router.get('/', requireReadUsers, upstreamHandlers.listUsers);
router.get('/search', requireReadUsers, upstreamHandlers.searchUsers);

router.get('/:userId', async (req, res) => {
  try {
    const user = await adminUserService.getUserDetail(req.params.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.status(200).json(user);
  } catch {
    res.status(500).json({ message: 'Error fetching user details' });
  }
});

/**
 * Aktivitetsoverblik til admin-GUI'ens "Aktivitet"-fane.
 * Login-tidspunkt aflæses af sessionens ObjectId (sessions har ingen createdAt).
 */
router.get('/:userId/activity', requireReadUsers, async (req, res) => {
  try {
    const { userId } = req.params;
    if (!isValidUserId(userId)) {
      return res.status(400).json({ message: 'Invalid user id' });
    }
    const { Conversation, Message, Session, Transaction } = mongoose.models;
    const userOid = new mongoose.Types.ObjectId(userId);
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const now = new Date();

    const [
      lastMessage,
      lastConversation,
      conversationsTotal,
      conversations30d,
      messagesTotal,
      userMessages30d,
      sessions,
      tokenUsage,
      bans,
    ] = await Promise.all([
      Message.findOne({ user: userId }).sort({ createdAt: -1 }).select('createdAt').lean(),
      Conversation.findOne({ user: userId })
        .sort({ updatedAt: -1 })
        .select('updatedAt title')
        .lean(),
      Conversation.countDocuments({ user: userId }),
      Conversation.countDocuments({ user: userId, updatedAt: { $gte: since } }),
      Message.countDocuments({ user: userId }),
      Message.countDocuments({ user: userId, isCreatedByUser: true, createdAt: { $gte: since } }),
      Session.find({ user: userOid, expiration: { $gt: now } })
        .sort({ _id: -1 })
        .select('_id expiration')
        .lean(),
      Transaction.aggregate([
        { $match: { user: userOid, createdAt: { $gte: since } } },
        {
          $group: {
            _id: '$model',
            tokens: { $sum: { $abs: { $ifNull: ['$rawAmount', 0] } } },
            requests: { $sum: { $cond: [{ $eq: ['$tokenType', 'prompt'] }, 1, 0] } },
          },
        },
        { $sort: { tokens: -1 } },
      ]),
      getActiveUserBans([userId]),
    ]);

    const bannedUntil = bans.get(userId);
    res.status(200).json({
      lastMessageAt: lastMessage?.createdAt ?? null,
      lastConversation: lastConversation
        ? { title: lastConversation.title ?? null, updatedAt: lastConversation.updatedAt }
        : null,
      conversations: { total: conversationsTotal, last30Days: conversations30d },
      messages: { total: messagesTotal, sentLast30Days: userMessages30d },
      sessions: sessions.map((s) => ({
        startedAt: s._id.getTimestamp(),
        expiresAt: s.expiration,
      })),
      tokensLast30Days: {
        total: tokenUsage.reduce((sum, m) => sum + m.tokens, 0),
        byModel: tokenUsage.map((m) => ({
          model: m._id ?? 'unknown',
          tokens: m.tokens,
          requests: m.requests,
        })),
      },
      bannedUntil: bannedUntil ? new Date(bannedUntil).toISOString() : null,
    });
  } catch {
    res.status(500).json({ message: 'Error fetching user activity' });
  }
});

router.put('/:userId', async (req, res) => {
  try {
    const updated = await adminUserService.adminUpdateUser(req.params.userId, req.body);
    if (!updated) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.status(200).json(updated);
  } catch {
    res.status(500).json({ message: 'Error updating user' });
  }
});

router.delete('/:userId', async (req, res) => {
  try {
    const result = await adminUserService.adminDeleteUser(req.params.userId);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error deleting user' });
  }
});

router.post('/:userId/ban', async (req, res) => {
  try {
    if (!isValidUserId(req.params.userId)) {
      return res.status(400).json({ message: 'Invalid user id' });
    }
    const durationMs = parseBanDuration(req.body);
    if (!durationMs) {
      return res.status(400).json({ message: 'Invalid ban duration' });
    }

    const expiresAt = await banUser(req.params.userId, durationMs);
    res
      .status(200)
      .json({ message: 'User banned successfully', expiresAt: new Date(expiresAt).toISOString() });
  } catch {
    res.status(500).json({ message: 'Error banning user' });
  }
});

router.post('/:userId/unban', async (req, res) => {
  try {
    if (!isValidUserId(req.params.userId)) {
      return res.status(400).json({ message: 'Invalid user id' });
    }
    await unbanUser(req.params.userId);
    res.status(200).json({ message: 'User unbanned successfully' });
  } catch {
    res.status(500).json({ message: 'Error unbanning user' });
  }
});

router.post('/:userId/reset-password', async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }
    const result = await adminUserService.resetPassword(req.params.userId, newPassword);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error resetting password' });
  }
});

router.post('/:userId/impersonate', async (req, res) => {
  try {
    const { setAuthTokens } = require('~/server/services/AuthService');
    const adminUserId = req.user._id.toString();
    const token = await setAuthTokens(req.params.userId, res);

    res.cookie('impersonate_admin_id', adminUserId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000,
    });

    res.status(200).json({ token });
  } catch {
    res.status(500).json({ message: 'Error impersonating user' });
  }
});

router.post('/:userId/balance', async (req, res) => {
  try {
    const { amount, mode } = req.body;
    if (amount == null || !['add', 'set'].includes(mode)) {
      return res.status(400).json({ message: 'Invalid balance parameters' });
    }
    const result = await adminUserService.setBalance(req.params.userId, { amount, mode });
    res.status(200).json(result);
  } catch {
    res.status(500).json({ message: 'Error updating balance' });
  }
});

module.exports = router;
