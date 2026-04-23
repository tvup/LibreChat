import React, { useState } from 'react';
import { Coins, BarChart3, Users, Cpu, Calendar, TrendingUp } from 'lucide-react';
import { useAdminTokenStats } from '~/data-provider';
import { useLocalize } from '~/hooks';

function formatTokens(num: number): string {
  if (num >= 1_000_000_000) {
    return `${(num / 1_000_000_000).toFixed(1)}B`;
  }
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)}M`;
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(1)}K`;
  }
  return num.toLocaleString();
}

function getDayLabel(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString(undefined, { weekday: 'short' });
}

function getBarColor(index: number, total: number): string {
  const colors = [
    'bg-green-400',
    'bg-green-500',
    'bg-emerald-500',
    'bg-emerald-600',
    'bg-teal-500',
    'bg-teal-600',
    'bg-cyan-600',
  ];
  if (total <= colors.length) {
    return colors[index] ?? 'bg-green-500';
  }
  return colors[index % colors.length] ?? 'bg-green-500';
}

export default function AdminTokens() {
  const localize = useLocalize();
  const { data: stats, isLoading } = useAdminTokenStats();
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);

  const maxDaily = stats?.dailyUsage?.reduce((max, d) => Math.max(max, Math.abs(d.tokens)), 0) ?? 0;
  const maxModel = stats?.usageByModel?.reduce((max, m) => Math.max(max, Math.abs(m.totalTokens)), 0) ?? 0;

  const weeklyTotal = stats?.dailyUsage?.reduce((sum, d) => sum + Math.abs(d.tokens), 0) ?? 0;
  const dailyAverage = stats?.dailyUsage?.length
    ? Math.round(weeklyTotal / stats.dailyUsage.length)
    : 0;

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-semibold text-text-primary">
        {localize('com_admin_token_usage')}
      </h1>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-xl border border-border-light bg-surface-secondary p-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-surface-hover">
              <Coins className="size-4 text-text-secondary" />
            </div>
            <div>
              <p className="text-xs text-text-secondary">
                {localize('com_admin_total_tokens')}
              </p>
              {isLoading ? (
                <div className="mt-1 h-6 w-16 animate-pulse rounded bg-surface-hover" />
              ) : (
                <p className="text-xl font-semibold text-text-primary">
                  {formatTokens(Math.abs(stats?.totalTokens ?? 0))}
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border-light bg-surface-secondary p-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-surface-hover">
              <Calendar className="size-4 text-text-secondary" />
            </div>
            <div>
              <p className="text-xs text-text-secondary">
                {localize('com_admin_total_this_week')}
              </p>
              {isLoading ? (
                <div className="mt-1 h-6 w-16 animate-pulse rounded bg-surface-hover" />
              ) : (
                <p className="text-xl font-semibold text-text-primary">
                  {formatTokens(weeklyTotal)}
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border-light bg-surface-secondary p-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-surface-hover">
              <TrendingUp className="size-4 text-text-secondary" />
            </div>
            <div>
              <p className="text-xs text-text-secondary">
                {localize('com_admin_avg_per_day')}
              </p>
              {isLoading ? (
                <div className="mt-1 h-6 w-16 animate-pulse rounded bg-surface-hover" />
              ) : (
                <p className="text-xl font-semibold text-text-primary">
                  {formatTokens(dailyAverage)}
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border-light bg-surface-secondary p-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-surface-hover">
              <Users className="size-4 text-text-secondary" />
            </div>
            <div>
              <p className="text-xs text-text-secondary">
                {localize('com_admin_top_users_count')}
              </p>
              {isLoading ? (
                <div className="mt-1 h-6 w-12 animate-pulse rounded bg-surface-hover" />
              ) : (
                <p className="text-xl font-semibold text-text-primary">
                  {stats?.topUsers?.length ?? 0}
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border-light bg-surface-secondary p-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-surface-hover">
              <Cpu className="size-4 text-text-secondary" />
            </div>
            <div>
              <p className="text-xs text-text-secondary">
                {localize('com_admin_models_used')}
              </p>
              {isLoading ? (
                <div className="mt-1 h-6 w-12 animate-pulse rounded bg-surface-hover" />
              ) : (
                <p className="text-xl font-semibold text-text-primary">
                  {stats?.usageByModel?.length ?? 0}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Daily Usage Bar Chart */}
      <div className="mb-6 rounded-xl border border-border-light bg-surface-secondary p-6">
        <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-text-primary">
          <BarChart3 className="size-5" />
          {localize('com_admin_daily_usage')}
        </h2>
        {isLoading ? (
          <div className="flex h-40 items-end gap-2">
            {Array.from({ length: 7 }, (_, i) => (
              <div
                key={i}
                className="flex-1 animate-pulse rounded-t bg-surface-hover"
                style={{ height: `${30 + Math.random() * 70}%` }}
              />
            ))}
          </div>
        ) : !stats?.dailyUsage || stats.dailyUsage.length === 0 ? (
          <p className="py-8 text-center text-sm text-text-secondary">
            {localize('com_admin_no_token_data')}
          </p>
        ) : (
          <div className="flex h-48 items-end gap-3">
            {stats.dailyUsage.map((day, index) => {
              const height = maxDaily > 0 ? (Math.abs(day.tokens) / maxDaily) * 100 : 0;
              const isHovered = hoveredBar === index;
              return (
                <div
                  key={day.date}
                  className="relative flex flex-1 flex-col items-center gap-1"
                  onMouseEnter={() => setHoveredBar(index)}
                  onMouseLeave={() => setHoveredBar(null)}
                >
                  {isHovered && (
                    <div className="absolute -top-10 z-10 whitespace-nowrap rounded-lg border border-border-light bg-surface-primary px-3 py-1.5 text-xs font-medium text-text-primary shadow-lg">
                      {Math.abs(day.tokens).toLocaleString()} tokens
                    </div>
                  )}
                  <span className="text-xs font-medium text-text-secondary">
                    {formatTokens(Math.abs(day.tokens))}
                  </span>
                  <div className="flex w-full justify-center" style={{ height: '140px' }}>
                    <div
                      className={`w-full max-w-14 rounded-t transition-all ${getBarColor(index, stats.dailyUsage.length)} ${isHovered ? 'opacity-80 ring-2 ring-green-400/50' : ''}`}
                      style={{ height: `${Math.max(height, 3)}%`, marginTop: 'auto' }}
                    />
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-xs font-semibold text-text-primary">
                      {getDayLabel(day.date)}
                    </span>
                    <span className="text-xs text-text-secondary">
                      {new Date(day.date).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Top Users */}
        <div className="rounded-xl border border-border-light bg-surface-secondary p-6">
          <h2 className="mb-4 text-base font-semibold text-text-primary">
            {localize('com_admin_top_users_by_tokens')}
          </h2>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }, (_, i) => (
                <div key={i} className="h-8 animate-pulse rounded bg-surface-hover" />
              ))}
            </div>
          ) : !stats?.topUsers || stats.topUsers.length === 0 ? (
            <p className="py-4 text-center text-sm text-text-secondary">
              {localize('com_admin_no_token_data')}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-light">
                    <th className="pb-2 text-left font-medium text-text-secondary">#</th>
                    <th className="pb-2 text-left font-medium text-text-secondary">User</th>
                    <th className="pb-2 text-right font-medium text-text-secondary">Tokens</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.topUsers.map((user, index) => (
                    <tr
                      key={user.userId}
                      className="border-b border-border-light last:border-0"
                    >
                      <td className="py-2 text-text-secondary">{index + 1}</td>
                      <td className="py-2">
                        <p className="text-text-primary">{user.name || user.email || 'Unknown'}</p>
                        {user.name && user.email && (
                          <p className="text-xs text-text-secondary">{user.email}</p>
                        )}
                      </td>
                      <td className="py-2 text-right font-mono text-text-primary">
                        {formatTokens(Math.abs(user.totalTokens))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Usage by Model */}
        <div className="rounded-xl border border-border-light bg-surface-secondary p-6">
          <h2 className="mb-4 text-base font-semibold text-text-primary">
            {localize('com_admin_usage_by_model')}
          </h2>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }, (_, i) => (
                <div key={i} className="h-8 animate-pulse rounded bg-surface-hover" />
              ))}
            </div>
          ) : !stats?.usageByModel || stats.usageByModel.length === 0 ? (
            <p className="py-4 text-center text-sm text-text-secondary">
              {localize('com_admin_no_token_data')}
            </p>
          ) : (
            <div className="space-y-3">
              {stats.usageByModel.map((model) => {
                const percentage = maxModel > 0
                  ? Math.round((Math.abs(model.totalTokens) / maxModel) * 100)
                  : 0;
                return (
                  <div key={model.model}>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="truncate text-sm text-text-primary">{model.model}</span>
                      <span className="ml-2 shrink-0 text-xs text-text-secondary">
                        {formatTokens(Math.abs(model.totalTokens))}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-surface-hover">
                      <div
                        className="h-full rounded-full bg-green-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
