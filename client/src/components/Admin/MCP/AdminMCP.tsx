import React from 'react';
import { Server, RefreshCw, Wrench, Globe } from 'lucide-react';
import { useAdminMCPServers, useAdminMCPStats, useAdminReinitializeMCP } from '~/data-provider';
import { useAdminToast } from '~/components/Admin/useAdminToast';
import { useLocalize } from '~/hooks';

import type { AdminMCPServer } from 'librechat-data-provider';

function getTypeBadgeClass(type?: string): string {
  switch (type) {
    case 'stdio':
      return 'bg-blue-500/10 text-blue-500';
    case 'sse':
      return 'bg-green-500/10 text-green-500';
    case 'websocket':
      return 'bg-purple-500/10 text-purple-500';
    default:
      return 'bg-gray-500/10 text-gray-500';
  }
}

function StatCard({
  icon: Icon,
  label,
  value,
  loading,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  loading: boolean;
}) {
  return (
    <div className="rounded-xl border border-border-light bg-surface-secondary p-4">
      <div className="flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-lg bg-surface-hover">
          <Icon className="size-4 text-text-secondary" />
        </div>
        <div>
          <p className="text-xs text-text-secondary">{label}</p>
          {loading ? (
            <div className="mt-1 h-6 w-12 animate-pulse rounded bg-surface-hover" />
          ) : (
            <p className="text-xl font-semibold text-text-primary">
              {typeof value === 'number' ? value.toLocaleString() : value}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminMCP() {
  const localize = useLocalize();
  const { showSuccess, showError } = useAdminToast();
  const { data: servers, isLoading } = useAdminMCPServers();
  const { data: stats, isLoading: statsLoading } = useAdminMCPStats();
  const reinitializeMutation = useAdminReinitializeMCP();

  const handleReinitialize = (serverName: string) => {
    reinitializeMutation.mutate(serverName, {
      onSuccess: () => showSuccess(`${serverName} reinitialize request sent`),
      onError: () => showError(`Failed to reinitialize ${serverName}`),
    });
  };

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-semibold text-text-primary">
        {localize('com_admin_mcp_servers')}
      </h1>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          icon={Server}
          label={localize('com_admin_mcp_total_servers')}
          value={stats?.totalServers ?? 0}
          loading={statsLoading}
        />
        {stats?.serversByType?.map((item) => (
          <StatCard
            key={item.type}
            icon={Globe}
            label={item.type.toUpperCase()}
            value={item.count}
            loading={statsLoading}
          />
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-surface-secondary" />
          ))}
        </div>
      ) : !servers || servers.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border-light bg-surface-secondary py-16">
          <Server className="mb-4 size-12 text-text-secondary opacity-40" />
          <p className="mb-1 text-lg font-medium text-text-primary">
            {localize('com_admin_mcp_no_servers')}
          </p>
          <p className="text-sm text-text-secondary">
            {localize('com_admin_mcp_no_servers_description')}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {servers.map((server: AdminMCPServer) => (
            <div
              key={server._id}
              className="rounded-xl border border-border-light bg-surface-secondary p-4 transition-colors hover:bg-surface-hover"
            >
              <div className="mb-2 flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Server className="size-5 text-text-secondary" />
                  <h3 className="text-sm font-semibold text-text-primary">{server.name}</h3>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${getTypeBadgeClass(server.type)}`}
                >
                  {server.type ?? 'unknown'}
                </span>
              </div>

              {server.url && (
                <p className="mb-2 truncate text-xs text-text-secondary" title={server.url}>
                  {server.url}
                </p>
              )}

              <div className="mb-3 flex items-center gap-2">
                <Wrench className="size-3.5 text-text-secondary" />
                <span className="text-xs text-text-secondary">
                  {server.tools?.length ?? 0} {localize('com_admin_mcp_tools')}
                </span>
              </div>

              {server.tools && server.tools.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-1">
                  {server.tools.slice(0, 5).map((tool) => (
                    <span
                      key={tool}
                      className="rounded bg-surface-primary px-1.5 py-0.5 text-xs text-text-secondary"
                    >
                      {tool}
                    </span>
                  ))}
                  {server.tools.length > 5 && (
                    <span className="rounded bg-surface-primary px-1.5 py-0.5 text-xs text-text-secondary">
                      +{server.tools.length - 5} more
                    </span>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-xs text-text-secondary">
                  {server.createdAt
                    ? new Date(server.createdAt).toLocaleDateString()
                    : ''}
                </span>
                <button
                  onClick={() => handleReinitialize(server.name)}
                  disabled={reinitializeMutation.isLoading}
                  className="flex items-center gap-1.5 rounded-lg border border-border-light px-3 py-1.5 text-xs text-text-primary hover:bg-surface-primary disabled:opacity-50"
                  aria-label={`Reinitialize ${server.name}`}
                >
                  <RefreshCw className="size-3.5" />
                  {localize('com_admin_mcp_reinitialize')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
