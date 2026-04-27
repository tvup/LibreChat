import mongoose from 'mongoose';
import { logger } from '@librechat/data-schemas';

import type {
  AdminUserItem,
  AdminUserDetail,
  AdminUserListParams,
  AdminUserListResponse,
  AdminUpdateUserRequest,
  AdminSetBalanceRequest,
} from 'librechat-data-provider';

const SAFE_USER_FIELDS =
  '_id name username email role provider avatar emailVerified twoFactorEnabled createdAt updatedAt';

const DETAIL_USER_FIELDS =
  `${SAFE_USER_FIELDS} googleId openidId githubId discordId appleId facebookId samlId ldapId plugins favorites termsAccepted personalization`;

export async function listUsers(params: AdminUserListParams): Promise<AdminUserListResponse> {
  const User = mongoose.models.User;
  const {
    search,
    role,
    provider,
    limit = 25,
    cursor,
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = params;

  const filter: Record<string, unknown> = {};

  if (search) {
    const regex = new RegExp(search, 'i');
    filter.$or = [{ email: regex }, { name: regex }, { username: regex }];
  }

  if (role) {
    filter.role = role;
  }

  if (provider) {
    filter.provider = provider;
  }

  if (cursor) {
    const direction = sortOrder === 'desc' ? '$lt' : '$gt';
    filter._id = { [direction]: cursor };
  }

  const sortDirection = sortOrder === 'desc' ? -1 : 1;

  const [users, totalCount] = await Promise.all([
    User.find(filter)
      .select(SAFE_USER_FIELDS)
      .sort({ [sortBy]: sortDirection, _id: sortDirection })
      .limit(limit + 1)
      .lean()
      .exec() as unknown as Promise<AdminUserItem[]>,
    User.countDocuments(cursor ? {} : filter),
  ]);

  const hasNextPage = users.length > limit;
  const data = hasNextPage ? users.slice(0, limit) : users;
  const lastItem = data[data.length - 1];

  return {
    data,
    pagination: {
      hasNextPage,
      hasPreviousPage: !!cursor,
      nextCursor: hasNextPage && lastItem ? String(lastItem._id) : undefined,
      totalCount,
    },
  };
}

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
