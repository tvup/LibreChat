import React from 'react';
import { Plug, BarChart3 } from 'lucide-react';
import { useAdminEndpointStats } from '~/data-provider';
import { useLocalize } from '~/hooks';

export default function AdminEndpoints() {
  const localize = useLocalize();
  const { data: stats, isLoading } = useAdminEndpointStats();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-text-secondary">Loading endpoint stats...</p>
      </div>
    );
  }

  const maxCount =
    stats?.endpointCounts.reduce((max, e) => Math.max(max, e.count), 0) ?? 1;

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-semibold text-text-primary">
        {localize('com_admin_endpoints')}
      </h1>

      {/* Endpoint Usage Cards */}
      <div className="mb-8">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-medium text-text-primary">
          <Plug className="size-5" />
          {localize('com_admin_endpoint_usage')}
        </h2>
        {!stats || stats.endpointCounts.length === 0 ? (
          <div className="rounded-xl border border-border-light bg-surface-secondary py-8 text-center">
            <p className="text-sm text-text-secondary">
              {localize('com_admin_no_endpoint_data')}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {stats.endpointCounts.map((ep) => (
              <div
                key={ep.endpoint}
                className="rounded-xl border border-border-light bg-surface-secondary p-4"
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium text-text-primary">
                    {ep.endpoint}
                  </span>
                  <span className="text-lg font-semibold text-text-primary">
                    {ep.count.toLocaleString()}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-surface-hover">
                  <div
                    className="h-full rounded-full bg-green-500 transition-all"
                    style={{ width: `${(ep.count / maxCount) * 100}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-text-secondary">
                  {localize('com_admin_conversations').toLowerCase()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Model Usage Table */}
      <div>
        <h2 className="mb-4 flex items-center gap-2 text-lg font-medium text-text-primary">
          <BarChart3 className="size-5" />
          {localize('com_admin_model_usage')}
        </h2>
        {!stats || stats.modelUsage.length === 0 ? (
          <div className="rounded-xl border border-border-light bg-surface-secondary py-8 text-center">
            <p className="text-sm text-text-secondary">
              {localize('com_admin_no_model_data')}
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border-light">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border-light bg-surface-secondary">
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary">
                    #
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary">
                    {localize('com_admin_endpoint')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary">
                    {localize('com_admin_model')}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary">
                    {localize('com_admin_conversations')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {stats.modelUsage.map((mu, i) => (
                  <tr
                    key={`${mu.endpoint}-${mu.model}`}
                    className="border-b border-border-light bg-surface-primary last:border-b-0"
                  >
                    <td className="px-4 py-3 text-xs text-text-secondary">{i + 1}</td>
                    <td className="px-4 py-3 text-sm text-text-primary">{mu.endpoint}</td>
                    <td className="px-4 py-3 text-sm font-mono text-text-primary">
                      {mu.model}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-medium text-text-primary">
                      {mu.count.toLocaleString()}
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
