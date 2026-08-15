import mongoose from 'mongoose';
import { logger } from '@librechat/data-schemas';

import type {
  AdminUserItem,
  AdminUserDetail,
  AdminUpdateUserRequest,
  AdminSetBalanceRequest,
} from 'librechat-data-provider';

/**
 * NB: listUsers + searchUsers er flyttet til upstream's createAdminUsersHandlers
 * (mountet direkte i api/server/routes/admin/users.js). Forken's egne
 * detail/update/delete/balance/reset-password-funktioner forbliver her —
 * upstream har ikke pendant for dem endnu.
 */

const SAFE_USER_FIELDS =
  '_id name username email role provider avatar emailVerified twoFactorEnabled createdAt updatedAt';

const DETAIL_USER_FIELDS =
  `${SAFE_USER_FIELDS} googleId openidId githubId discordId appleId facebookId samlId ldapId plugins favorites termsAccepted personalization`;

export async function getUserDetail(userId: string): Promise<AdminUserDetail | null> {
  const User = mongoose.models.User;
  const Balance = mongoose.models.Balance;

  const user = (await User.findById(userId)
    .select(DETAIL_USER_FIELDS)
    .lean()
    .exec()) as AdminUserDetail | null;
  if (!user) {
    return null;
  }

  const balanceDoc = (await Balance.findOne({ user: userId })
    .select('tokenCredits')
    .lean()
    .exec()) as { tokenCredits?: number } | null;

  return {
    ...user,
    _id: String(user._id),
    balance: balanceDoc?.tokenCredits ?? 0,
  };
}

export async function adminUpdateUser(
  userId: string,
  data: AdminUpdateUserRequest,
): Promise<AdminUserItem | null> {
  const User = mongoose.models.User;
  return (await User.findByIdAndUpdate(userId, { $set: data }, { new: true, runValidators: true })
    .select(SAFE_USER_FIELDS)
    .lean()
    .exec()) as AdminUserItem | null;
}

export async function adminDeleteUser(userId: string): Promise<{ message: string }> {
  const User = mongoose.models.User;
  const result = await User.deleteOne({ _id: userId });

  if (result.deletedCount === 0) {
    throw new Error('User not found');
  }

  logger.info(`[Admin] User ${userId} deleted`);
  return { message: 'User deleted successfully' };
}

export async function resetPassword(
  userId: string,
  newPassword: string,
): Promise<{ message: string }> {
  const User = mongoose.models.User;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const bcrypt = require('bcryptjs');
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(newPassword, salt);

  const result = await User.findByIdAndUpdate(userId, { $set: { password: hashedPassword } });
  if (!result) {
    throw new Error('User not found');
  }

  logger.info(`[Admin] Password reset for user ${userId}`);
  return { message: 'Password reset successfully' };
}

export async function setBalance(
  userId: string,
  data: AdminSetBalanceRequest,
): Promise<{ balance: number }> {
  const Balance = mongoose.models.Balance;
  const { amount, mode } = data;

  const update =
    mode === 'set' ? { $set: { tokenCredits: amount } } : { $inc: { tokenCredits: amount } };

  const result = (await Balance.findOneAndUpdate({ user: userId }, update, {
    upsert: true,
    new: true,
  })
    .lean()
    .exec()) as { tokenCredits?: number } | null;

  return { balance: result?.tokenCredits ?? 0 };
}
