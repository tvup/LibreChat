import mongoose from 'mongoose';
import { logger } from '@librechat/data-schemas';

import type {
  AdminFileItem,
  AdminFileListResponse,
  AdminFileStats,
} from 'librechat-data-provider';

interface FileListParams {
  limit?: number;
  cursor?: string;
  search?: string;
  userId?: string;
}

interface RawFile {
  _id: mongoose.Types.ObjectId;
  file_id: string;
  filename: string;
  filepath: string;
  source: string;
  type: string;
  bytes: number;
  usage?: number;
  user: string;
  createdAt: string;
}

interface RawUser {
  _id: mongoose.Types.ObjectId;
  name?: string;
  email: string;
}

export async function listFiles(params: FileListParams): Promise<AdminFileListResponse> {
  const File = mongoose.models.File;
  const User = mongoose.models.User;
  const { limit = 25, cursor, search, userId } = params;

  const filter: Record<string, unknown> = {};

  if (userId) {
    filter.user = userId;
  }

  if (search) {
    filter.filename = { $regex: search, $options: 'i' };
  }

  if (cursor) {
    filter._id = { $lt: new mongoose.Types.ObjectId(cursor) };
  }

  const files = (await File.find(filter)
    .select('_id file_id filename filepath source type bytes usage user createdAt')
    .sort({ _id: -1 })
    .limit(limit + 1)
    .lean()
    .exec()) as unknown as RawFile[];

  const hasNextPage = files.length > limit;
  const sliced = hasNextPage ? files.slice(0, limit) : files;

  const userIds = [...new Set(sliced.map((f) => f.user))];
  const users = (await User.find({ _id: { $in: userIds } })
    .select('_id name email')
    .lean()
    .exec()) as unknown as RawUser[];

  const userMap = new Map<string, { _id: string; name?: string; email: string }>();
  for (const u of users) {
    userMap.set(String(u._id), { _id: String(u._id), name: u.name, email: u.email });
  }

  const data: AdminFileItem[] = sliced.map((f) => ({
    _id: String(f._id),
    file_id: f.file_id,
    filename: f.filename,
    filepath: f.filepath,
    source: f.source,
    type: f.type,
    size: f.bytes,
    usage: f.usage,
    user: userMap.get(String(f.user)) ?? { _id: String(f.user), email: 'Unknown' },
    createdAt: f.createdAt,
  }));

  const lastRawItem = sliced[sliced.length - 1];
  const totalCount = cursor ? undefined : await File.countDocuments(search ? filter : {});

  return {
    data,
    pagination: {
      hasNextPage,
      nextCursor: hasNextPage && lastRawItem ? String(lastRawItem._id) : undefined,
      totalCount,
    },
  };
}

interface FilesByTypeResult {
  _id: string;
  count: number;
  totalSize: number;
}

export async function getFileStats(): Promise<AdminFileStats> {
  const File = mongoose.models.File;

  const [totalFiles, totalSizeResult, filesByType] = await Promise.all([
    File.estimatedDocumentCount(),
    File.aggregate([{ $group: { _id: null, totalSize: { $sum: '$bytes' } } }]),
    File.aggregate([
      { $group: { _id: '$type', count: { $sum: 1 }, totalSize: { $sum: '$bytes' } } },
      { $sort: { count: -1 } },
    ]) as Promise<FilesByTypeResult[]>,
  ]);

  const totalSize =
    totalSizeResult.length > 0
      ? (totalSizeResult[0] as { totalSize: number }).totalSize
      : 0;

  return {
    totalFiles,
    totalSize,
    filesByType: filesByType.map((item) => ({
      type: item._id,
      count: item.count,
      totalSize: item.totalSize,
    })),
  };
}

export async function deleteFile(fileId: string): Promise<{ message: string }> {
  const File = mongoose.models.File;

  const result = await File.deleteOne({ file_id: fileId });
  if (result.deletedCount === 0) {
    throw new Error('File not found');
  }

  logger.info(`[Admin] File ${fileId} deleted`);
  return { message: 'File deleted successfully' };
}
