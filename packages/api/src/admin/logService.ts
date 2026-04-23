import { ViolationTypes } from 'librechat-data-provider';

import type { AdminViolationSummary, AdminSystemInfo } from 'librechat-data-provider';

export async function getViolationLogs(): Promise<AdminViolationSummary[]> {
  const results: AdminViolationSummary[] = [];

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const getLogStores = require('~/cache/getLogStores');

    for (const violationType of Object.values(ViolationTypes)) {
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
  } catch {
    for (const violationType of Object.values(ViolationTypes)) {
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
