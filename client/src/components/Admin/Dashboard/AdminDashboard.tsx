import React from 'react';
import { Users, MessageSquare, UserPlus, Activity, ShieldOff, Globe } from 'lucide-react';
import { useAdminDashboard } from '~/data-provider';
import { useLocalize } from '~/hooks';

import type { AdminDashboardRecentUser, AdminDashboardProviderStat } from 'librechat-data-provider';

function StatCard({
  icon: Icon,
  label,
  value,
  loading,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  loading: boolean;
}) {
  return (
    <div className="rounded-xl border border-border-light bg-surface-secondary p-6">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-lg bg-surface-hover">
          <Icon className="size-5 text-text-secondary" />
        </div>
        <div>
          <p className="text-sm text-text-secondary">{label}</p>
          {loading ? (
            <div className="mt-1 h-7 w-16 animate-pulse rounded bg-surface-hover" />
          ) : (
            <p className="text-2xl font-semibold text-text-primary">
              {value.toLocaleString()}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function RecentRegistrations({
  users,
  loading,
  label,
}: {
  users: AdminDashboardRecentUser[];
  loading: boolean;
  label: string;
}) {
  const localize = useLocalize();
  return (
    <div className="rounded-xl border border-border-light bg-surface-secondary p-6">
      <h2 className="mb-4 text-base font-semibold text-text-primary">{label}</h2>
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="h-8 animate-pulse rounded bg-surface-hover" />
          ))}
        </div>
      ) : users.length === 0 ? (
        <p className="text-sm text-text-secondary">
          {localize('com_admin_no_recent_registrations')}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-light">
                <th className="pb-2 text-left font-medium text-text-secondary">
                  {localize('com_admin_user_name')}
                </th>
                <th className="pb-2 text-left font-medium text-text-secondary">
                  {localize('com_admin_registered_at')}
                </th>
                <th className="pb-2 text-left font-medium text-text-secondary">
                  {localize('com_admin_last_active')}
                </th>
                <th className="pb-2 text-right font-medium text-text-secondary">
                  {localize('com_admin_messages')}
                </th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user._id} className="border-b border-border-light last:border-0">
                  <td className="py-2 pr-3">
                    <p className="text-sm font-medium text-text-primary">
                      {user.name || user.email.split('@')[0]}
                    </p>
                    <p className="text-xs text-text-secondary">{user.email}</p>
                  </td>
                  <td className="py-2 pr-3 text-xs text-text-secondary">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td className="py-2 pr-3 text-xs text-text-secondary">
                    {user.lastActive
                      ? new Date(user.lastActive).toLocaleDateString()
                      : localize('com_admin_never')}
                  </td>
                  <td className="py-2 text-right text-xs font-medium text-text-primary">
                    {(user.messageCount ?? 0).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function AuthProviders({
  providers,
  loading,
  label,
}: {
  providers: AdminDashboardProviderStat[];
  loading: boolean;
  label: string;
}) {
  const total = providers.reduce((sum, p) => sum + p.count, 0);

  return (
    <div className="rounded-xl border border-border-light bg-surface-secondary p-6">
      <h2 className="mb-4 text-base font-semibold text-text-primary">{label}</h2>
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="h-8 animate-pulse rounded bg-surface-hover" />
          ))}
        </div>
      ) : providers.length === 0 ? (
        <p className="text-sm text-text-secondary">No data</p>
      ) : (
        <div className="space-y-3">
          {providers.map((provider) => {
            const percentage = total > 0 ? Math.round((provider.count / total) * 100) : 0;
            return (
              <div key={provider.provider}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-sm font-medium capitalize text-text-primary">
                    {provider.provider}
                  </span>
                  <span className="text-xs text-text-secondary">
                    {provider.count.toLocaleString()} ({percentage}%)
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
  );
}

export default function AdminDashboard() {
  const { data, isLoading } = useAdminDashboard();
  const localize = useLocalize();

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-semibold text-text-primary">
        {localize('com_admin_dashboard')}
      </h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          icon={Users}
          label={localize('com_admin_total_users')}
          value={data?.totalUsers ?? 0}
          loading={isLoading}
        />
        <StatCard
          icon={UserPlus}
          label={localize('com_admin_new_users_7d')}
          value={data?.newUsersLast7Days ?? 0}
          loading={isLoading}
        />
        <StatCard
          icon={UserPlus}
          label={localize('com_admin_new_users_30d')}
          value={data?.newUsersLast30Days ?? 0}
          loading={isLoading}
        />
        <StatCard
          icon={MessageSquare}
          label={localize('com_admin_total_conversations')}
          value={data?.totalConversations ?? 0}
          loading={isLoading}
        />
        <StatCard
          icon={Activity}
          label={localize('com_admin_active_conversations_7d')}
          value={data?.activeConversationsLast7Days ?? 0}
          loading={isLoading}
        />
        <StatCard
          icon={ShieldOff}
          label={localize('com_admin_banned_users')}
          value={data?.totalBannedUsers ?? 0}
          loading={isLoading}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <RecentRegistrations
          users={data?.recentRegistrations ?? []}
          loading={isLoading}
          label={localize('com_admin_recent_registrations')}
        />
        <AuthProviders
          providers={data?.topProviders ?? []}
          loading={isLoading}
          label={localize('com_admin_auth_providers')}
        />
      </div>
    </div>
  );
}
