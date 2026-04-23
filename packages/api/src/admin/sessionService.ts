import mongoose from 'mongoose';
import { logger } from '@librechat/data-schemas';

import type { AdminActiveSession } from 'librechat-data-provider';

interface SessionAggregateResult {
  _id: mongoose.Types.ObjectId;
  sessionCount: number;
  lastActive: Date;
}

interface RawUser {
  _id: mongoose.Types.ObjectId;
  name?: string;
  email: string;
}

export async function getActiveSessions(): Promise<AdminActiveSession[]> {
  const Session = mongoose.models.Session;
  const User = mongoose.models.User;

  const sessionAgg = (await Session.aggregate([
    { $match: { expiration: { $gt: new Date() } } },
    {
      $group: {
        _id: '$user',
        sessionCount: { $sum: 1 },
        lastActive: { $max: '$expiration' },
      },
    },
    { $sort: { lastActive: -1 } },
  ])) as SessionAggregateResult[];

  const userIds = sessionAgg.map((s) => s._id);
  const users = (await User.find({ _id: { $in: userIds } })
    .select('_id name email')
    .lean()
    .exec()) as unknown as RawUser[];

  const userMap = new Map<string, { name?: string; email: string }>();
  for (const u of users) {
    userMap.set(String(u._id), { name: u.name, email: u.email });
  }

  return sessionAgg.map((s) => {
    const userInfo = userMap.get(String(s._id));
    return {
      _id: String(s._id),
      name: userInfo?.name,
      email: userInfo?.email ?? 'Unknown',
      sessionCount: s.sessionCount,
      lastActive: s.lastActive.toISOString(),
    };
  });
}

export async function revokeUserSessions(userId: string): Promise<{ message: string }> {
  const Session = mongoose.models.Session;

  const result = await Session.deleteMany({ user: new mongoose.Types.ObjectId(userId) });

  logger.info(`[Admin] Revoked ${result.deletedCount} sessions for user ${userId}`);
  return { message: `Revoked ${result.deletedCount} sessions` };
}
