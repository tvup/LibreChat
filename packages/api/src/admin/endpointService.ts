import mongoose from 'mongoose';

import type { AdminEndpointStats } from 'librechat-data-provider';

interface EndpointCountResult {
  _id: string;
  count: number;
}

interface ModelUsageResult {
  _id: { endpoint: string; model: string };
  count: number;
}

export async function getEndpointStats(): Promise<AdminEndpointStats> {
  const Conversation = mongoose.models.Conversation;

  const [endpointResults, modelResults] = await Promise.all([
    Conversation.aggregate([
      { $group: { _id: '$endpoint', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]) as Promise<EndpointCountResult[]>,
    Conversation.aggregate([
      { $group: { _id: { endpoint: '$endpoint', model: '$model' }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 20 },
    ]) as Promise<ModelUsageResult[]>,
  ]);

  return {
    endpointCounts: endpointResults.map((r) => ({
      endpoint: r._id ?? 'unknown',
      count: r.count,
    })),
    modelUsage: modelResults.map((r) => ({
      endpoint: r._id.endpoint ?? 'unknown',
      model: r._id.model ?? 'unknown',
      count: r.count,
    })),
  };
}
