import React, { useState } from 'react';
import { SystemRoles } from 'librechat-data-provider';
import { X, Copy, Check } from 'lucide-react';
import { useAdminInviteUser } from '~/data-provider';
import { useAdminToast } from '~/components/Admin/useAdminToast';
import { useLocalize } from '~/hooks';

interface AdminInviteUserProps {
  onClose: () => void;
}

export default function AdminInviteUser({ onClose }: AdminInviteUserProps) {
  const localize = useLocalize();
  const { showSuccess } = useAdminToast();
  const inviteMutation = useAdminInviteUser();

  const [email, setEmail] = useState('');
  const [role, setRole] = useState(SystemRoles.USER);
  const [error, setError] = useState('');
  const [tempPassword, setTempPassword] = useState('');
  const [copied, setCopied] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      setError(localize('com_admin_email_required'));
      return;
    }

    inviteMutation.mutate(
      { email: email.trim(), role },
      {
        onSuccess: (data) => {
          setTempPassword(data.tempPassword);
          showSuccess(localize('com_admin_toast_user_invited'));
        },
        onError: (err: unknown) => {
          const message =
            err instanceof Error ? err.message : 'Error inviting user';
          setError(message);
        },
      },
    );
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(tempPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-xl border border-border-light bg-surface-primary p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text-primary">
            {localize('com_admin_invite_user')}
          </h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-text-secondary hover:bg-surface-hover hover:text-text-primary"
          >
            <X className="size-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-500/10 px-4 py-2 text-sm text-red-500">
            {error}
          </div>
        )}

        {tempPassword ? (
          <div className="space-y-4">
            <p className="text-sm text-text-secondary">
              {localize('com_admin_invite_success_message')}
            </p>
            <div>
              <label className="mb-1 block text-sm font-medium text-text-secondary">
                {localize('com_admin_temp_password')}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={tempPassword}
                  className="flex-1 rounded-lg border border-border-light bg-surface-secondary px-3 py-2 font-mono text-sm text-text-primary"
                />
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1 rounded-lg border border-border-light px-3 py-2 text-sm text-text-secondary hover:bg-surface-hover"
                >
                  {copied ? <Check className="size-4 text-green-500" /> : <Copy className="size-4" />}
                  {copied ? localize('com_admin_copied') : localize('com_admin_copy')}
                </button>
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <button
                onClick={onClose}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
              >
                {localize('com_admin_done')}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="invite-user-email"
                className="mb-1 block text-sm font-medium text-text-secondary"
              >
                Email *
              </label>
              <input
                id="invite-user-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-border-light bg-surface-secondary px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-border-heavy focus:outline-none"
                placeholder="user@example.com"
              />
            </div>

            <div>
              <label
                htmlFor="invite-user-role"
                className="mb-1 block text-sm font-medium text-text-secondary"
              >
                Role
              </label>
              <select
                id="invite-user-role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full rounded-lg border border-border-light bg-surface-secondary px-3 py-2 text-sm text-text-primary"
              >
                <option value={SystemRoles.USER}>User</option>
                <option value={SystemRoles.ADMIN}>Admin</option>
              </select>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-border-light px-4 py-2 text-sm text-text-secondary hover:bg-surface-hover"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={inviteMutation.isLoading}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                {inviteMutation.isLoading ? 'Inviting...' : localize('com_admin_invite_user')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
