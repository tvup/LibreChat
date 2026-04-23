import mongoose from 'mongoose';
import { ViolationTypes } from 'librechat-data-provider';

import type { AdminDashboardStats, AdminDashboardRecentUser } from 'librechat-data-provider';

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
    User.aggregate([
      { $group: { _id: '$provider', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $project: { _id: 0, provider: '$_id', count: 1 } },
    ]) as Promise<Array<{ provider: string; count: number }>>,
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
