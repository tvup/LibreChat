import React, { useCallback, useState } from 'react';
import { MonitorSmartphone, Trash2 } from 'lucide-react';
import { useAdminSessions, useAdminRevokeSessions } from '~/data-provider';
import { useAdminToast } from '~/components/Admin/useAdminToast';
import ConfirmDialog from '~/components/Admin/ConfirmDialog';
import { useLocalize } from '~/hooks';

import type { AdminActiveSession } from 'librechat-data-provider';

export default function AdminSessions() {
  const localize = useLocalize();
  const { showSuccess, showError } = useAdminToast();
  const { data: sessions, isLoading } = useAdminSessions();
  const revokeMutation = useAdminRevokeSessions();
  const [revokeConfirm, setRevokeConfirm] = useState<{ userId: string; email: string } | null>(null);

  const handleRevoke = useCallback(
    (userId: string, email: string) => {
      setRevokeConfirm({ userId, email });
    },
    [],
  );

  const confirmRevoke = useCallback(() => {
    if (!revokeConfirm) {
      return;
    }
    revokeMutation.mutate(revokeConfirm.userId, {
      onSuccess: () => showSuccess(localize('com_admin_toast_session_revoked')),
      onError: () => showError(localize('com_admin_toast_error')),
    });
    setRevokeConfirm(null);
  }, [revokeConfirm, revokeMutation, showSuccess, showError, localize]);

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-semibold text-text-primary">
        {localize('com_admin_sessions')}
      </h1>

      <div className="mb-6 rounded-xl border border-border-light bg-surface-secondary p-4">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-surface-hover">
            <MonitorSmartphone className="size-4 text-text-secondary" />
          </div>
          <div>
            <p className="text-xs text-text-secondary">
              {localize('com_admin_active_users')}
            </p>
            {isLoading ? (
              <div className="mt-1 h-6 w-12 animate-pulse rounded bg-surface-hover" />
            ) : (
              <p className="text-xl font-semibold text-text-primary">
                {sessions?.length ?? 0}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border-light">
        <table className="w-full text-sm">
          <thead className="border-b border-border-light bg-surface-secondary">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-text-secondary">
                {localize('com_admin_session_user')}
              </th>
              <th className="px-4 py-3 text-left font-medium text-text-secondary">
                {localize('com_admin_session_count')}
              </th>
              <th className="px-4 py-3 text-left font-medium text-text-secondary">
                {localize('com_admin_session_last_active')}
              </th>
              <th className="px-4 py-3 text-right font-medium text-text-secondary">
                {localize('com_admin_file_actions')}
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-text-secondary">
                  Loading...
                </td>
              </tr>
            ) : !sessions || sessions.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-text-secondary">
                  {localize('com_admin_no_sessions')}
                </td>
              </tr>
            ) : (
              sessions.map((session: AdminActiveSession) => (
                <tr
                  key={session._id}
                  className="border-b border-border-light last:border-0 hover:bg-surface-hover"
                >
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-text-primary">{session.name || '-'}</p>
                      <p className="text-xs text-text-secondary">{session.email}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{session.sessionCount}</td>
                  <td className="px-4 py-3 text-text-secondary">
                    {session.lastActive
                      ? new Date(session.lastActive).toLocaleString()
                      : '-'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleRevoke(session._id, session.email)}
                      disabled={revokeMutation.isLoading}
                      className="rounded p-1 text-red-500 hover:bg-red-500/10"
                      title={localize('com_admin_revoke_sessions')}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={revokeConfirm !== null}
        title={localize('com_admin_revoke_sessions')}
        message={`Revoke all sessions for ${revokeConfirm?.email ?? ''}?`}
        confirmLabel="Revoke"
        variant="danger"
        onConfirm={confirmRevoke}
        onCancel={() => setRevokeConfirm(null)}
      />
    </div>
  );
}
