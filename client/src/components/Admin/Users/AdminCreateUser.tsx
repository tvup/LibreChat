import React, { useState } from 'react';
import { SystemRoles } from 'librechat-data-provider';
import { X } from 'lucide-react';
import { useAdminCreateUser } from '~/data-provider';
import { useAdminToast } from '~/components/Admin/useAdminToast';
import { useLocalize } from '~/hooks';

interface AdminCreateUserProps {
  onClose: () => void;
}

export default function AdminCreateUser({ onClose }: AdminCreateUserProps) {
  const localize = useLocalize();
  const { showSuccess } = useAdminToast();
  const createMutation = useAdminCreateUser();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState(SystemRoles.USER);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      setError(localize('com_admin_email_required'));
      return;
    }

    if (!password || password.length < 8) {
      setError(localize('com_admin_password_min'));
      return;
    }

    createMutation.mutate(
      { name: name.trim() || undefined, email: email.trim(), password, role },
      {
        onSuccess: () => {
          showSuccess(localize('com_admin_toast_user_created'));
          onClose();
        },
        onError: (err: unknown) => {
          const message =
            err instanceof Error ? err.message : 'Error creating user';
          setError(message);
        },
      },
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-xl border border-border-light bg-surface-primary p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text-primary">
            {localize('com_admin_create_user')}
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

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="create-user-name"
              className="mb-1 block text-sm font-medium text-text-secondary"
            >
              Name
            </label>
            <input
              id="create-user-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-border-light bg-surface-secondary px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-border-heavy focus:outline-none"
              placeholder="John Doe"
            />
          </div>

          <div>
            <label
              htmlFor="create-user-email"
              className="mb-1 block text-sm font-medium text-text-secondary"
            >
              Email *
            </label>
            <input
              id="create-user-email"
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
              htmlFor="create-user-password"
              className="mb-1 block text-sm font-medium text-text-secondary"
            >
              Password *
            </label>
            <input
              id="create-user-password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-border-light bg-surface-secondary px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-border-heavy focus:outline-none"
              placeholder="Minimum 8 characters"
            />
          </div>

          <div>
            <label
              htmlFor="create-user-role"
              className="mb-1 block text-sm font-medium text-text-secondary"
            >
              Role
            </label>
            <select
              id="create-user-role"
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
              disabled={createMutation.isLoading}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              {createMutation.isLoading ? 'Creating...' : localize('com_admin_create_user')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
