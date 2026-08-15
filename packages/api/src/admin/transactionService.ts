import mongoose from 'mongoose';

export interface DailyTokenUsage {
  date: string;
  tokens: number;
}

export interface UserTokenUsage {
  userId: string;
  name?: string;
  email?: string;
  totalTokens: number;
}

export interface ModelTokenUsage {
  model: string;
  totalTokens: number;
}

export interface TokenStatsResult {
  totalTokens: number;
  dailyUsage: DailyTokenUsage[];
  topUsers: UserTokenUsage[];
  usageByModel: ModelTokenUsage[];
}

export async function getTokenStats(): Promise<TokenStatsResult> {
  const Transaction = mongoose.models.Transaction;
  if (!Transaction) {
    return { totalTokens: 0, dailyUsage: [], topUsers: [], usageByModel: [] };
  }

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [totalResult, dailyResult, topUsersResult, modelResult] = await Promise.all([
    Transaction.aggregate([
      {
        $group: {
          _id: null,
          totalTokens: {
            $sum: { $abs: { $ifNull: ['$rawAmount', 0] } },
          },
        },
      },
    ]) as Promise<Array<{ totalTokens: number }>>,

    Transaction.aggregate([
      { $match: { createdAt: { $gte: sevenDaysAgo } } },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
          },
          tokens: {
            $sum: { $abs: { $ifNull: ['$rawAmount', 0] } },
          },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          date: '$_id',
          tokens: 1,
        },
      },
    ]) as Promise<DailyTokenUsage[]>,

    Transaction.aggregate([
      {
        $group: {
          _id: '$user',
          totalTokens: {
            $sum: { $abs: { $ifNull: ['$rawAmount', 0] } },
          },
        },
      },
      { $sort: { totalTokens: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'userInfo',
          pipeline: [{ $project: { name: 1, email: 1 } }],
        },
      },
      {
        $project: {
          _id: 0,
          userId: { $toString: '$_id' },
          totalTokens: 1,
          name: { $arrayElemAt: ['$userInfo.name', 0] },
          email: { $arrayElemAt: ['$userInfo.email', 0] },
        },
      },
    ]) as Promise<UserTokenUsage[]>,

    Transaction.aggregate([
      { $match: { model: { $ne: null, $exists: true } } },
      {
        $group: {
          _id: '$model',
          totalTokens: {
            $sum: { $abs: { $ifNull: ['$rawAmount', 0] } },
          },
        },
      },
      { $sort: { totalTokens: -1 } },
      { $limit: 20 },
      {
        $project: {
          _id: 0,
          model: '$_id',
          totalTokens: 1,
        },
      },
    ]) as Promise<ModelTokenUsage[]>,
  ]);

  return {
    totalTokens: totalResult[0]?.totalTokens ?? 0,
    dailyUsage: dailyResult,
    topUsers: topUsersResult,
    usageByModel: modelResult,
  };
}
