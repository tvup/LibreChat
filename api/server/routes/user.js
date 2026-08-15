const express = require('express');
const {
  updateUserPluginsController,
  resendVerificationController,
  getTermsStatusController,
  acceptTermsController,
  verifyEmailController,
  deleteUserController,
  getUserController,
} = require('~/server/controllers/UserController');
const {
  verifyEmailLimiter,
  verifyEmailSubmissionLimiter,
  configMiddleware,
  canDeleteAccount,
  requireJwtAuth,
} = require('~/server/middleware');

const settings = require('./settings');

const router = express.Router();

router.use('/settings', settings);
router.get('/', requireJwtAuth, getUserController);
router.get('/terms', requireJwtAuth, getTermsStatusController);
router.post('/terms/accept', requireJwtAuth, acceptTermsController);
router.post('/plugins', requireJwtAuth, updateUserPluginsController);
router.delete('/delete', requireJwtAuth, canDeleteAccount, configMiddleware, deleteUserController);
/** Preferred Name */
router.patch('/preferred-name', requireJwtAuth, async (req, res) => {
  try {
    const { preferredName } = req.body;
    if (typeof preferredName !== 'string') {
      return res.status(400).json({ message: 'preferredName must be a string' });
    }
    const { updateUser } = require('~/models');
    await updateUser(req.user.id, { preferredName: preferredName.trim() });
    res.status(200).json({ preferredName: preferredName.trim() });
  } catch (error) {
    res.status(500).json({ message: 'Error updating preferred name' });
  }
});

router.post('/verify', verifyEmailSubmissionLimiter, verifyEmailController);
router.post('/verify/resend', verifyEmailLimiter, resendVerificationController);

/** Linked Accounts */
router.get('/linked-accounts', requireJwtAuth, async (req, res) => {
  try {
    const { getUserById } = require('~/models');
    const user = await getUserById(req.user.id, 'provider googleId githubId discordId facebookId appleId openidId samlId ldapId');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const providers = [];
    const providerFields = [
      { key: 'googleId', name: 'google' },
      { key: 'githubId', name: 'github' },
      { key: 'discordId', name: 'discord' },
      { key: 'facebookId', name: 'facebook' },
      { key: 'appleId', name: 'apple' },
      { key: 'openidId', name: 'openid' },
      { key: 'samlId', name: 'saml' },
      { key: 'ldapId', name: 'ldap' },
    ];

    for (const { key, name } of providerFields) {
      if (user[key]) {
        providers.push({ provider: name, linked: true });
      }
    }

    const hasPassword = user.provider === 'local';
    if (hasPassword) {
      providers.unshift({ provider: 'local', linked: true });
    }

    res.status(200).json({ providers, primaryProvider: user.provider });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching linked accounts' });
  }
});

router.delete('/linked-accounts/:provider', requireJwtAuth, async (req, res) => {
  try {
    const { getUserById, updateUser } = require('~/models');
    const user = await getUserById(req.user.id, 'provider googleId githubId discordId facebookId appleId openidId samlId ldapId password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const providerToUnlink = req.params.provider;
    const providerKeyMap = {
      google: 'googleId',
      github: 'githubId',
      discord: 'discordId',
      facebook: 'facebookId',
      apple: 'appleId',
      openid: 'openidId',
      saml: 'samlId',
      ldap: 'ldapId',
    };

    const providerKey = providerKeyMap[providerToUnlink];
    if (!providerKey) {
      return res.status(400).json({ message: 'Invalid provider' });
    }

    if (!user[providerKey]) {
      return res.status(400).json({ message: 'Provider not linked' });
    }

    if (user.provider === providerToUnlink && !user.password) {
      return res.status(400).json({ message: 'Cannot unlink primary provider without a password set' });
    }

    const mongoose = require('mongoose');
    const User = mongoose.models.User;
    await User.findByIdAndUpdate(req.user.id, { $unset: { [providerKey]: '' } });

    res.status(200).json({ message: `${providerToUnlink} unlinked successfully` });
  } catch (error) {
    res.status(500).json({ message: 'Error unlinking account' });
  }
});

module.exports = router;
