import { ViolationTypes } from 'librechat-data-provider';

import type { AdminViolationSummary, AdminSystemInfo } from 'librechat-data-provider';

/** Shape of the keyv-backed store `~/cache/getLogStores` returns in the Express app. */
export interface LogStoreLike {
  size?: () => Promise<number> | number;
  opts?: { store?: { size?: number }; namespace?: string };
}
export type GetLogStores = (type: string) => LogStoreLike | undefined;

/**
 * `getLogStores` lives in the Express app's cache layer, not in this package, so the caller
 * injects it; omitting it (no caller currently does) reports every violation type as zero.
 */
export async function getViolationLogs(
  getLogStores?: GetLogStores,
): Promise<AdminViolationSummary[]> {
  const results: AdminViolationSummary[] = [];

  for (const violationType of Object.values(ViolationTypes)) {
    if (!getLogStores) {
      results.push({ type: violationType, count: 0 });
      continue;
    }
    try {
      const store = getLogStores(violationType);
      let count = 0;
      if (store && typeof store.opts?.store?.size === 'number') {
        count = store.opts.store.size;
      } else if (store && typeof store.size === 'function') {
        count = (await store.size()) as number;
      }
      results.push({ type: violationType, count });
    } catch {
      results.push({ type: violationType, count: 0 });
    }
  }

  return results.sort((a, b) => b.count - a.count);
}

export function getSystemInfo(): AdminSystemInfo {
  const mem = process.memoryUsage();
  return {
    uptime: process.uptime(),
    nodeVersion: process.version,
    memoryUsage: {
      rss: mem.rss,
      heapTotal: mem.heapTotal,
      heapUsed: mem.heapUsed,
    },
    platform: process.platform,
  };
}
