import mongoose from 'mongoose';
import { logger } from '@librechat/data-schemas';

import type {
  AdminConversationItem,
  AdminConversationListResponse,
  AdminConversationStats,
} from 'librechat-data-provider';

interface ConversationListParams {
  limit?: number;
  cursor?: string;
  search?: string;
  userId?: string;
  contentSearch?: string;
}

export async function listConversations(
  params: ConversationListParams,
): Promise<AdminConversationListResponse> {
  const Conversation = mongoose.models.Conversation;
  const User = mongoose.models.User;
  const Message = mongoose.models.Message;
  const { limit = 25, cursor, search, userId, contentSearch } = params;

  const filter: Record<string, unknown> = {};

  if (userId) {
    filter.user = userId;
  }

  if (contentSearch) {
    const matchingMessages = await Message.find(
      { text: { $regex: contentSearch, $options: 'i' } },
      { conversationId: 1 },
    )
      .limit(500)
      .lean()
      .exec() as Array<{ conversationId: string }>;

    const conversationIds = [...new Set(matchingMessages.map((m) => m.conversationId))];
    filter.conversationId = { $in: conversationIds };
  } else if (search) {
    filter.title = { $regex: search, $options: 'i' };
  }

  if (cursor) {
    filter._id = { $lt: new mongoose.Types.ObjectId(cursor) };
  }

  interface RawConversation {
    _id: mongoose.Types.ObjectId;
    conversationId: string;
    title: string;
    user: string;
    createdAt: string;
    updatedAt: string;
    endpoint?: string;
    model?: string;
  }

  interface RawUser {
    _id: mongoose.Types.ObjectId;
    name?: string;
    email: string;
  }

  const conversations = (await Conversation.find(filter)
    .select('_id conversationId title user createdAt updatedAt endpoint model')
    .sort({ _id: -1 })
    .limit(limit + 1)
    .lean()
    .exec()) as unknown as RawConversation[];

  const hasNextPage = conversations.length > limit;
  const sliced = hasNextPage ? conversations.slice(0, limit) : conversations;

  const userIds = [...new Set(sliced.map((c) => c.user))];
  const users = (await User.find({ _id: { $in: userIds } })
    .select('_id name email')
    .lean()
    .exec()) as unknown as RawUser[];

  const userMap = new Map<string, { _id: string; name?: string; email: string }>();
  for (const u of users) {
    userMap.set(String(u._id), { _id: String(u._id), name: u.name, email: u.email });
  }

  const data: AdminConversationItem[] = sliced.map((c) => ({
    conversationId: c.conversationId,
    title: c.title,
    user: userMap.get(String(c.user)) ?? { _id: String(c.user), email: 'Unknown' },
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    endpoint: c.endpoint,
    model: c.model,
  }));

  const lastRawItem = sliced[sliced.length - 1];
  const totalCount = cursor ? undefined : await Conversation.countDocuments(search ? filter : {});

  return {
    data,
    pagination: {
      hasNextPage,
      nextCursor: hasNextPage && lastRawItem ? String(lastRawItem._id) : undefined,
      totalCount,
    },
  };
}

export async function getConversationStats(): Promise<AdminConversationStats> {
  const Conversation = mongoose.models.Conversation;

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [totalConversations, conversationsToday, conversationsThisWeek] = await Promise.all([
    Conversation.estimatedDocumentCount(),
    Conversation.countDocuments({ createdAt: { $gte: startOfToday } }),
    Conversation.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
  ]);

  return {
    totalConversations,
    conversationsToday,
    conversationsThisWeek,
  };
}

export async function deleteConversation(conversationId: string): Promise<{ message: string }> {
  const Conversation = mongoose.models.Conversation;
  const Message = mongoose.models.Message;

  const result = await Conversation.deleteOne({ conversationId });
  if (result.deletedCount === 0) {
    throw new Error('Conversation not found');
  }

  await Message.deleteMany({ conversationId });

  logger.info(`[Admin] Conversation ${conversationId} and its messages deleted`);
  return { message: 'Conversation deleted successfully' };
}
