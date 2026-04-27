const express = require('express');
const crypto = require('crypto');
const { adminUserService, createAdminUsersHandlers } = require('@librechat/api');
const { SystemCapabilities } = require('@librechat/data-schemas');
const { requireCapability } = require('~/server/middleware/roles/capabilities');
const db = require('~/models');

const router = express.Router();

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
  deleteUserById: db.deleteUserById,
  deleteConfig: db.deleteConfig,
  deleteAclEntries: db.deleteAclEntries,
});

const SAFE_USER_FIELDS =
  '_id name username email role provider avatar emailVerified twoFactorEnabled createdAt updatedAt';

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
      const created = user.createdAt
        ? new Date(user.createdAt).toISOString().split('T')[0]
        : '';
      res.write(`"${name}","${email}","${role}","${provider}","${emailVerified}","${twoFA}","${created}"\n`);
    }

    res.end();
  } catch (error) {
    res.status(500).json({ message: 'Error exporting users' });
  }
});

router.post('/bulk/ban', async (req, res) => {
  try {
    const { userIds, duration } = req.body;
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ message: 'userIds array is required' });
    }
    if (!duration || duration <= 0) {
      return res.status(400).json({ message: 'Invalid ban duration' });
    }

    const banLogs = require('~/cache/getLogStores')(
      require('librechat-data-provider').ViolationTypes.BAN,
    );
    const durationMs = duration * 60000;
    const expiresAt = Date.now() + durationMs;

    for (const userId of userIds) {
      await banLogs.set(userId, {
        type: 'admin_ban',
        violation_count: 0,
        duration: durationMs,
        expiresAt,
      });
    }

    res.status(200).json({ message: `${userIds.length} users banned successfully` });
  } catch (error) {
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
  } catch (error) {
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
    const result = await User.updateMany(
      { _id: { $in: userIds } },
      { $set: { role } },
    );

    res.status(200).json({ message: `${result.modifiedCount} users updated successfully` });
  } catch (error) {
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
  } catch (error) {
    res.status(500).json({ message: 'Error fetching user details' });
  }
});

router.put('/:userId', async (req, res) => {
  try {
    const updated = await adminUserService.adminUpdateUser(req.params.userId, req.body);
    if (!updated) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.status(200).json(updated);
  } catch (error) {
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
    const { duration } = req.body;
    if (!duration || duration <= 0) {
      return res.status(400).json({ message: 'Invalid ban duration' });
    }

    const banLogs = require('~/cache/getLogStores')(
      require('librechat-data-provider').ViolationTypes.BAN,
    );
    const durationMs = duration * 60000;
    const expiresAt = Date.now() + durationMs;

    await banLogs.set(req.params.userId, {
      type: 'admin_ban',
      violation_count: 0,
      duration: durationMs,
      expiresAt,
    });

    res.status(200).json({ message: 'User banned successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error banning user' });
  }
});

router.post('/:userId/unban', async (req, res) => {
  try {
    const banLogs = require('~/cache/getLogStores')(
      require('librechat-data-provider').ViolationTypes.BAN,
    );
    await banLogs.delete(req.params.userId);
    res.status(200).json({ message: 'User unbanned successfully' });
  } catch (error) {
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
  } catch (error) {
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
  } catch (error) {
    res.status(500).json({ message: 'Error updating balance' });
  }
});

module.exports = router;
