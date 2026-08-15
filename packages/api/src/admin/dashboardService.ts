import mongoose from 'mongoose';
import { ViolationTypes } from 'librechat-data-provider';

import type { AdminDashboardStats, AdminDashboardRecentUser } from 'librechat-data-provider';

/**
 * Counts unique users per auth provider, attributing each user to every
 * provider they actually authenticate with — not just their primary
 * `provider` field.  A user can have any combination of:
 *   - `provider: 'local'` (created via email/password)
 *   - `<x>Id` fields (googleId, discordId, …) populated when they linked an
 *     OAuth account; passport-strategies set these on first social login.
 *   - SocialMapping rows that route an OAuth identity to a different local
 *     account (admin-managed cross-provider login).
 *
 * Each of these contributes the user to the corresponding provider bucket.
 * Totals can therefore sum to more than the user count, which mirrors
 * reality: one user, multiple login paths.
 */
const OAUTH_ID_FIELDS = [
  ['googleId', 'google'],
  ['discordId', 'discord'],
  ['facebookId', 'facebook'],
  ['githubId', 'github'],
  ['appleId', 'apple'],
  ['openidId', 'openid'],
  ['samlId', 'saml'],
  ['ldapId', 'ldap'],
] as const;

type UserProviderRow = {
  _id: mongoose.Types.ObjectId;
  provider?: string;
} & Partial<Record<(typeof OAUTH_ID_FIELDS)[number][0], string>>;

async function aggregateAuthProviders(
  User: mongoose.Model<unknown>,
): Promise<Array<{ provider: string; count: number }>> {
  const SocialMapping = mongoose.models.SocialMapping;

  const projection: Record<string, 1> = { provider: 1 };
  for (const [field] of OAUTH_ID_FIELDS) {
    projection[field] = 1;
  }

  const [users, mappings] = await Promise.all([
    User.find({}, projection).lean().exec() as unknown as Promise<UserProviderRow[]>,
    SocialMapping
      ? (SocialMapping.find({}, { targetUserId: 1, provider: 1 })
          .lean()
          .exec() as unknown as Promise<
          Array<{ targetUserId: mongoose.Types.ObjectId; provider: string }>
        >)
      : Promise.resolve([] as Array<{ targetUserId: mongoose.Types.ObjectId; provider: string }>),
  ]);

  const userToProviders = new Map<string, Set<string>>();
  for (const u of users) {
    const set = new Set<string>();
    if (u.provider) {
      set.add(u.provider);
    }
    for (const [field, provider] of OAUTH_ID_FIELDS) {
      if (u[field]) {
        set.add(provider);
      }
    }
    userToProviders.set(String(u._id), set);
  }
  for (const m of mappings) {
    const key = String(m.targetUserId);
    const set = userToProviders.get(key);
    if (set) {
      set.add(m.provider);
    }
  }

  const counts = new Map<string, number>();
  for (const set of userToProviders.values()) {
    for (const provider of set) {
      counts.set(provider, (counts.get(provider) ?? 0) + 1);
    }
  }

  return Array.from(counts, ([provider, count]) => ({ provider, count })).sort(
    (a, b) => b.count - a.count,
  );
}

export async function getDashboardStats(): Promise<AdminDashboardStats> {
  const User = mongoose.models.User;
  const Conversation = mongoose.models.Conversation;
  const Message = mongoose.models.Message;

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    newUsersLast7Days,
    newUsersLast30Days,
    totalConversations,
    activeConversationsLast7Days,
    rawRecentUsers,
    topProviders,
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
    User.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
    Conversation.estimatedDocumentCount(),
    Conversation.countDocuments({ updatedAt: { $gte: sevenDaysAgo } }),
    User.find()
      .select('_id name email createdAt')
      .sort({ createdAt: -1 })
      .limit(5)
      .lean()
      .exec() as unknown as Promise<
      Array<{ _id: string; name?: string; email: string; createdAt: string }>
    >,
    aggregateAuthProviders(User),
  ]);

  // Enrich recent users with lastActive and messageCount
  const userIds = rawRecentUsers.map((u) => u._id);

  const [lastActiveResults, messageCountResults] = await Promise.all([
    Conversation.aggregate([
      { $match: { user: { $in: userIds.map((id) => String(id)) } } },
      { $group: { _id: '$user', lastActive: { $max: '$updatedAt' } } },
    ]) as Promise<Array<{ _id: string; lastActive: Date }>>,
    Message.aggregate([
      { $match: { user: { $in: userIds.map((id) => String(id)) } } },
      { $group: { _id: '$user', count: { $sum: 1 } } },
    ]) as Promise<Array<{ _id: string; count: number }>>,
  ]);

  const lastActiveMap = new Map(
    lastActiveResults.map((r) => [String(r._id), r.lastActive]),
  );
  const messageCountMap = new Map(
    messageCountResults.map((r) => [String(r._id), r.count]),
  );

  const recentRegistrations: AdminDashboardRecentUser[] = rawRecentUsers.map((u) => ({
    _id: String(u._id),
    name: u.name,
    email: u.email,
    createdAt: u.createdAt,
    lastActive: lastActiveMap.get(String(u._id))?.toISOString(),
    messageCount: messageCountMap.get(String(u._id)) ?? 0,
  }));

  let totalBannedUsers = 0;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const getLogStores = require('~/cache/getLogStores');
    const banLogs = getLogStores(ViolationTypes.BAN);
    if (banLogs && typeof banLogs.size === 'function') {
      totalBannedUsers = await banLogs.size();
    }
  } catch {
    totalBannedUsers = 0;
  }

  return {
    totalUsers,
    newUsersLast7Days,
    newUsersLast30Days,
    totalConversations,
    activeConversationsLast7Days,
    totalBannedUsers,
    recentRegistrations,
    topProviders,
  };
}
