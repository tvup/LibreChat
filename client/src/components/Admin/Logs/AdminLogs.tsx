import React from 'react';
import { Server, AlertTriangle, Clock, Cpu, HardDrive } from 'lucide-react';
import { useAdminViolations, useAdminSystemInfo } from '~/data-provider';
import { useLocalize } from '~/hooks';

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);

  const parts: string[] = [];
  if (days > 0) {
    parts.push(`${days}d`);
  }
  if (hours > 0) {
    parts.push(`${hours}h`);
  }
  parts.push(`${mins}m`);
  return parts.join(' ');
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export default function AdminLogs() {
  const localize = useLocalize();
  const { data: violations, isLoading: loadingViolations } = useAdminViolations({
    refetchInterval: 30000,
  });
  const { data: systemInfo, isLoading: loadingSystem } = useAdminSystemInfo({
    refetchInterval: 30000,
  });

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-semibold text-text-primary">
        {localize('com_admin_logs')}
      </h1>

      {/* System Info */}
      <div className="mb-8">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-medium text-text-primary">
          <Server className="size-5" />
          {localize('com_admin_system_info')}
        </h2>
        {loadingSystem ? (
          <p className="text-text-secondary">Loading system info...</p>
        ) : systemInfo ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-border-light bg-surface-secondary p-4">
              <div className="mb-2 flex items-center gap-2 text-text-secondary">
                <Clock className="size-4" />
                <span className="text-xs">{localize('com_admin_uptime')}</span>
              </div>
              <p className="text-xl font-semibold text-text-primary">
                {formatUptime(systemInfo.uptime)}
              </p>
            </div>
            <div className="rounded-xl border border-border-light bg-surface-secondary p-4">
              <div className="mb-2 flex items-center gap-2 text-text-secondary">
                <Cpu className="size-4" />
                <span className="text-xs">{localize('com_admin_node_version')}</span>
              </div>
              <p className="text-xl font-semibold text-text-primary">
                {systemInfo.nodeVersion}
              </p>
            </div>
            <div className="rounded-xl border border-border-light bg-surface-secondary p-4">
              <div className="mb-2 flex items-center gap-2 text-text-secondary">
                <HardDrive className="size-4" />
                <span className="text-xs">{localize('com_admin_memory_heap')}</span>
              </div>
              <p className="text-xl font-semibold text-text-primary">
                {formatBytes(systemInfo.memoryUsage.heapUsed)}
              </p>
              <p className="text-xs text-text-secondary">
                / {formatBytes(systemInfo.memoryUsage.heapTotal)}
              </p>
            </div>
            <div className="rounded-xl border border-border-light bg-surface-secondary p-4">
              <div className="mb-2 flex items-center gap-2 text-text-secondary">
                <Server className="size-4" />
                <span className="text-xs">{localize('com_admin_platform')}</span>
              </div>
              <p className="text-xl font-semibold text-text-primary">
                {systemInfo.platform}
              </p>
              <p className="text-xs text-text-secondary">
                RSS: {formatBytes(systemInfo.memoryUsage.rss)}
              </p>
            </div>
          </div>
        ) : null}
      </div>

      {/* Violations */}
      <div>
        <h2 className="mb-4 flex items-center gap-2 text-lg font-medium text-text-primary">
          <AlertTriangle className="size-5" />
          {localize('com_admin_violations')}
        </h2>
        {loadingViolations ? (
          <p className="text-text-secondary">Loading violations...</p>
        ) : !violations || violations.length === 0 ? (
          <div className="rounded-xl border border-border-light bg-surface-secondary py-8 text-center">
            <p className="text-sm text-text-secondary">{localize('com_admin_no_violations')}</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border-light">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border-light bg-surface-secondary">
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary">
                    {localize('com_admin_violation_type')}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary">
                    {localize('com_admin_violation_count')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {violations.map((v) => (
                  <tr
                    key={v.type}
                    className="border-b border-border-light bg-surface-primary last:border-b-0"
                  >
                    <td className="px-4 py-3 text-sm text-text-primary">{v.type}</td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`inline-block min-w-[3rem] rounded-full px-2 py-0.5 text-center text-xs font-medium ${
                          v.count > 0
                            ? 'bg-red-500/10 text-red-500'
                            : 'bg-gray-500/10 text-gray-500'
                        }`}
                      >
                        {v.count}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
