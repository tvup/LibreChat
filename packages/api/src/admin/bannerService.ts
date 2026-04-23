import mongoose from 'mongoose';
import { logger } from '@librechat/data-schemas';

import type {
  AdminBannerItem,
  AdminCreateBannerRequest,
  AdminUpdateBannerRequest,
} from 'librechat-data-provider';

export async function listBanners(): Promise<AdminBannerItem[]> {
  const Banner = mongoose.models.Banner;
  return (await Banner.find()
    .sort({ displayFrom: -1 })
    .lean()
    .exec()) as unknown as AdminBannerItem[];
}

export async function createBanner(data: AdminCreateBannerRequest): Promise<AdminBannerItem> {
  const Banner = mongoose.models.Banner;
  const banner = await Banner.create(data);
  logger.info(`[Admin] Banner created: ${data.bannerId}`);
  return banner.toObject() as AdminBannerItem;
}

export async function updateBanner(
  bannerId: string,
  data: AdminUpdateBannerRequest,
): Promise<AdminBannerItem | null> {
  const Banner = mongoose.models.Banner;
  const updated = (await Banner.findOneAndUpdate(
    { bannerId },
    { $set: data },
    { new: true },
  )
    .lean()
    .exec()) as AdminBannerItem | null;
  if (updated) {
    logger.info(`[Admin] Banner updated: ${bannerId}`);
  }
  return updated;
}

export async function deleteBanner(bannerId: string): Promise<{ message: string }> {
  const Banner = mongoose.models.Banner;
  const result = await Banner.deleteOne({ bannerId });
  if (result.deletedCount === 0) {
    throw new Error('Banner not found');
  }
  logger.info(`[Admin] Banner deleted: ${bannerId}`);
  return { message: 'Banner deleted successfully' };
}
