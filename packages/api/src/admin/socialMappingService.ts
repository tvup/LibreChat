import mongoose from 'mongoose';
import { logger } from '@librechat/data-schemas';

const socialMappingSchema = new mongoose.Schema(
  {
    socialEmail: { type: String, required: true, lowercase: true, trim: true },
    provider: { type: String, required: true },
    targetUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

socialMappingSchema.index({ socialEmail: 1, provider: 1 }, { unique: true });

function getModel() {
  return (
    mongoose.models.SocialMapping ||
    mongoose.model('SocialMapping', socialMappingSchema)
  );
}

export interface SocialMappingItem {
  _id: string;
  socialEmail: string;
  provider: string;
  targetUserId: string;
  targetUser?: { _id: string; name?: string; email: string };
  createdAt?: string;
}

export async function getMappingsForUser(
  userId: string,
): Promise<SocialMappingItem[]> {
  const SocialMapping = getModel();
  return (await SocialMapping.find({ targetUserId: userId })
    .lean()
    .exec()) as unknown as SocialMappingItem[];
}

export async function getAllMappings(): Promise<SocialMappingItem[]> {
  const SocialMapping = getModel();
  const User = mongoose.models.User;
  const mappings = (await SocialMapping.find()
    .sort({ createdAt: -1 })
    .lean()
    .exec()) as unknown as SocialMappingItem[];

  const userIds = [...new Set(mappings.map((m) => m.targetUserId.toString()))];
  const users = (await User.find({ _id: { $in: userIds } })
    .select('_id name email')
    .lean()
    .exec()) as Array<{ _id: mongoose.Types.ObjectId; name?: string; email: string }>;

  const userMap = new Map(users.map((u) => [u._id.toString(), u]));

  return mappings.map((m) => ({
    ...m,
    targetUser: userMap.get(m.targetUserId.toString()) as
      | { _id: string; name?: string; email: string }
      | undefined,
  }));
}

export async function createMapping(
  socialEmail: string,
  provider: string,
  targetUserId: string,
  createdBy?: string,
): Promise<SocialMappingItem> {
  const SocialMapping = getModel();
  const mapping = await SocialMapping.create({
    socialEmail: socialEmail.trim().toLowerCase(),
    provider,
    targetUserId,
    createdBy,
  });
  logger.info(
    `[Admin] Social mapping created: ${socialEmail} (${provider}) → user ${targetUserId}`,
  );
  return mapping.toObject() as unknown as SocialMappingItem;
}

export async function deleteMapping(mappingId: string): Promise<{ message: string }> {
  const SocialMapping = getModel();
  const result = await SocialMapping.deleteOne({ _id: mappingId });
  if (result.deletedCount === 0) {
    throw new Error('Mapping not found');
  }
  logger.info(`[Admin] Social mapping deleted: ${mappingId}`);
  return { message: 'Mapping deleted successfully' };
}

export async function findMappingByEmail(
  socialEmail: string,
  provider: string,
): Promise<SocialMappingItem | null> {
  const SocialMapping = getModel();
  return (await SocialMapping.findOne({
    socialEmail: socialEmail.trim().toLowerCase(),
    provider,
  })
    .lean()
    .exec()) as unknown as SocialMappingItem | null;
}
