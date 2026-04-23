import React, { useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { SystemRoles } from 'librechat-data-provider';
import { Search, ChevronRight, Ban, ShieldCheck, UserPlus, Download, Mail, Trash2, Users, LogIn } from 'lucide-react';
import {
  useAdminUsers,
  useAdminBanUser,
  useAdminDeleteUser,
  useAdminBulkBan,
  useAdminBulkDelete,
  useAdminBulkRole,
} from '~/data-provider';
import { useAdminToast } from '~/components/Admin/useAdminToast';
import ConfirmDialog from '~/components/Admin/ConfirmDialog';
import { useImpersonate } from '~/components/Admin/useImpersonate';
import AdminInviteUser from './AdminInviteUser';
import AdminCreateUser from './AdminCreateUser';
import { useLocalize } from '~/hooks';

import type { AdminUserItem } from 'librechat-data-provider';

function useDebounce(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value);
  React.useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export default function AdminUserList() {
  const localize = useLocalize();
  const { showSuccess, showError } = useAdminToast();
  const [searchInput, setSearchInput] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [providerFilter, setProviderFilter] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [banConfirm, setBanConfirm] = useState<{ userId: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ userId: string; email: string } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkBanConfirm, setBulkBanConfirm] = useState(false);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [bulkRoleConfirm, setBulkRoleConfirm] = useState(false);
  const [bulkRole, setBulkRole] = useState(SystemRoles.USER);

  const debouncedSearch = useDebounce(searchInput, 300);

  const params = useMemo(
    () => ({
      search: debouncedSearch || undefined,
      role: roleFilter || undefined,
      provider: providerFilter || undefined,
      limit: 25,
    }),
    [debouncedSearch, roleFilter, providerFilter],
  );

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useAdminUsers(params);
  const { impersonate } = useImpersonate();
  const banMutation = useAdminBanUser();
  const deleteMutation = useAdminDeleteUser();
  const bulkBanMutation = useAdminBulkBan();
  const bulkDeleteMutation = useAdminBulkDelete();
  const bulkRoleMutation = useAdminBulkRole();

  const users = useMemo(
    () => data?.pages.flatMap((page) => page.data) ?? [],
    [data],
  );

  const totalCount = data?.pages[0]?.pagination.totalCount ?? 0;

  const handleBan = useCallback(
    (userId: string) => {
      setBanConfirm({ userId });
    },
    [],
  );

  const confirmBan = useCallback(() => {
    if (!banConfirm) {
      return;
    }
    banMutation.mutate(
      { userId: banConfirm.userId, data: { duration: 1440 } },
      {
        onSuccess: () => showSuccess(localize('com_admin_toast_user_banned')),
        onError: () => showError(localize('com_admin_toast_error')),
      },
    );
    setBanConfirm(null);
  }, [banConfirm, banMutation, showSuccess, showError, localize]);

  const handleDelete = useCallback(
    (userId: string, email: string) => {
      setDeleteConfirm({ userId, email });
    },
    [],
  );

  const confirmDelete = useCallback(() => {
    if (!deleteConfirm) {
      return;
    }
    deleteMutation.mutate(deleteConfirm.userId, {
      onSuccess: () => showSuccess(localize('com_admin_toast_user_deleted')),
      onError: () => showError(localize('com_admin_toast_error')),
    });
    setDeleteConfirm(null);
  }, [deleteConfirm, deleteMutation, showSuccess, showError, localize]);

  const handleExportCsv = useCallback(() => {
    const link = document.createElement('a');
    link.href = '/api/admin/users/export/csv';
    link.download = '';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  const toggleSelect = useCallback((userId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (prev.size === users.length) {
        return new Set();
      }
      return new Set(users.map((u) => u._id));
    });
  }, [users]);

  const selectedArray = useMemo(() => [...selectedIds], [selectedIds]);

  const confirmBulkBan = useCallback(() => {
    bulkBanMutation.mutate(
      { userIds: selectedArray, duration: 1440 },
      {
        onSuccess: () => {
          showSuccess(localize('com_admin_toast_bulk_ban'));
          setSelectedIds(new Set());
        },
        onError: () => showError(localize('com_admin_toast_error')),
      },
    );
    setBulkBanConfirm(false);
  }, [selectedArray, bulkBanMutation, showSuccess, showError, localize]);

  const confirmBulkDelete = useCallback(() => {
    bulkDeleteMutation.mutate(
      { userIds: selectedArray },
      {
        onSuccess: () => {
          showSuccess(localize('com_admin_toast_bulk_delete'));
          setSelectedIds(new Set());
        },
        onError: () => showError(localize('com_admin_toast_error')),
      },
    );
    setBulkDeleteConfirm(false);
  }, [selectedArray, bulkDeleteMutation, showSuccess, showError, localize]);

  const confirmBulkRole = useCallback(() => {
    bulkRoleMutation.mutate(
      { userIds: selectedArray, role: bulkRole },
      {
        onSuccess: () => {
          showSuccess(localize('com_admin_toast_bulk_role'));
          setSelectedIds(new Set());
        },
        onError: () => showError(localize('com_admin_toast_error')),
      },
    );
    setBulkRoleConfirm(false);
  }, [selectedArray, bulkRole, bulkRoleMutation, showSuccess, showError, localize]);

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-text-primary">
          {localize('com_admin_user_management')}
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-2 rounded-lg border border-border-light bg-surface-secondary px-4 py-2 text-sm font-medium text-text-primary hover:bg-surface-hover"
          >
            <Download className="size-4" />
            {localize('com_admin_export_csv')}
          </button>
          <button
            onClick={() => setShowInviteDialog(true)}
            className="flex items-center gap-2 rounded-lg border border-border-light bg-surface-secondary px-4 py-2 text-sm font-medium text-text-primary hover:bg-surface-hover"
          >
            <Mail className="size-4" />
            {localize('com_admin_invite_user')}
          </button>
          <button
            onClick={() => setShowCreateDialog(true)}
            className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
          >
            <UserPlus className="size-4" />
            {localize('com_admin_new_user')}
          </button>
        </div>
      </div>

      {showCreateDialog && (
        <AdminCreateUser onClose={() => setShowCreateDialog(false)} />
      )}

      {showInviteDialog && (
        <AdminInviteUser onClose={() => setShowInviteDialog(false)} />
      )}

      {selectedIds.size > 0 && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-border-light bg-surface-secondary px-4 py-3">
          <span className="text-sm font-medium text-text-primary">
            {selectedIds.size} {localize('com_admin_selected')}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setBulkBanConfirm(true)}
              className="flex items-center gap-1 rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-700"
            >
              <Ban className="size-3" />
              {localize('com_admin_bulk_ban')}
            </button>
            <button
              onClick={() => setBulkDeleteConfirm(true)}
              className="flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
            >
              <Trash2 className="size-3" />
              {localize('com_admin_bulk_delete')}
            </button>
            <button
              onClick={() => setBulkRoleConfirm(true)}
              className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
            >
              <Users className="size-3" />
              {localize('com_admin_bulk_change_role')}
            </button>
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-secondary" />
          <input
            type="text"
            placeholder={localize('com_admin_search_users')}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full rounded-lg border border-border-light bg-surface-secondary py-2 pl-10 pr-3 text-sm text-text-primary placeholder:text-text-secondary focus:border-border-heavy focus:outline-none"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="rounded-lg border border-border-light bg-surface-secondary px-3 py-2 text-sm text-text-primary"
        >
          <option value="">All Roles</option>
          <option value={SystemRoles.ADMIN}>Admin</option>
          <option value={SystemRoles.USER}>User</option>
        </select>
        <select
          value={providerFilter}
          onChange={(e) => setProviderFilter(e.target.value)}
          className="rounded-lg border border-border-light bg-surface-secondary px-3 py-2 text-sm text-text-primary"
        >
          <option value="">All Providers</option>
          <option value="local">Local</option>
          <option value="google">Google</option>
          <option value="openid">OpenID</option>
          <option value="github">GitHub</option>
          <option value="discord">Discord</option>
        </select>
      </div>

      <p className="mb-3 text-sm text-text-secondary">
        {totalCount} {localize('com_admin_users_total')}
      </p>

      <div className="overflow-x-auto rounded-lg border border-border-light">
        <table className="w-full text-sm">
          <thead className="border-b border-border-light bg-surface-secondary">
            <tr>
              <th className="px-4 py-3 text-left">
                <input
                  type="checkbox"
                  checked={users.length > 0 && selectedIds.size === users.length}
                  onChange={toggleSelectAll}
                  className="size-4 rounded border-border-light"
                />
              </th>
              <th className="px-4 py-3 text-left font-medium text-text-secondary">Name</th>
              <th className="px-4 py-3 text-left font-medium text-text-secondary">Email</th>
              <th className="px-4 py-3 text-left font-medium text-text-secondary">Role</th>
              <th className="px-4 py-3 text-left font-medium text-text-secondary">Provider</th>
              <th className="px-4 py-3 text-left font-medium text-text-secondary">Created</th>
              <th className="px-4 py-3 text-right font-medium text-text-secondary">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-text-secondary">
                  Loading...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-text-secondary">
                  No users found
                </td>
              </tr>
            ) : (
              users.map((user: AdminUserItem) => (
                <tr
                  key={user._id}
                  className="border-b border-border-light last:border-0 hover:bg-surface-hover"
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(user._id)}
                      onChange={() => toggleSelect(user._id)}
                      className="size-4 rounded border-border-light"
                    />
                  </td>
                  <td className="px-4 py-3 text-text-primary">
                    <div className="flex items-center gap-2">
                      {user.avatar ? (
                        <img
                          src={user.avatar}
                          alt=""
                          className="size-7 rounded-full"
                        />
                      ) : (
                        <div className="flex size-7 items-center justify-center rounded-full bg-surface-hover text-xs font-medium text-text-secondary">
                          {(user.name || user.email)[0]?.toUpperCase()}
                        </div>
                      )}
                      {user.name || user.username || '-'}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-text-primary">{user.email}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                        user.role === SystemRoles.ADMIN
                          ? 'bg-green-500/10 text-green-500'
                          : 'bg-blue-500/10 text-blue-500'
                      }`}
                    >
                      {user.role === SystemRoles.ADMIN && <ShieldCheck className="size-3" />}
                      {user.role || 'user'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{user.provider}</td>
                  <td className="px-4 py-3 text-text-secondary">
                    {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '-'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => impersonate(user._id)}
                        className="rounded p-1 text-text-secondary hover:bg-amber-500/10 hover:text-amber-500"
                        title="Impersonate user"
                      >
                        <LogIn className="size-4" />
                      </button>
                      <button
                        onClick={() => handleBan(user._id)}
                        className="rounded p-1 text-text-secondary hover:bg-surface-hover hover:text-text-primary"
                        title="Ban user"
                      >
                        <Ban className="size-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(user._id, user.email)}
                        className="rounded p-1 text-red-500 hover:bg-red-500/10"
                        title="Delete user"
                      >
                        <span className="text-xs font-medium">Del</span>
                      </button>
                      <Link
                        to={`/admin/users/${user._id}`}
                        className="rounded p-1 text-text-secondary hover:bg-surface-hover hover:text-text-primary"
                      >
                        <ChevronRight className="size-4" />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {hasNextPage && (
        <div className="mt-4 flex justify-center">
          <button
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="rounded-lg bg-surface-secondary px-4 py-2 text-sm text-text-primary hover:bg-surface-hover disabled:opacity-50"
          >
            {isFetchingNextPage ? 'Loading...' : 'Load More'}
          </button>
        </div>
      )}

      <ConfirmDialog
        open={banConfirm !== null}
        title={localize('com_admin_ban_user')}
        message="Ban this user for 24 hours?"
        confirmLabel={localize('com_admin_ban_user')}
        variant="danger"
        onConfirm={confirmBan}
        onCancel={() => setBanConfirm(null)}
      />

      <ConfirmDialog
        open={deleteConfirm !== null}
        title={localize('com_admin_confirm_delete')}
        message={`This action cannot be undone. Type the user's email to confirm deletion.`}
        confirmLabel="Delete"
        variant="danger"
        requireInput={deleteConfirm?.email}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirm(null)}
      />

      <ConfirmDialog
        open={bulkBanConfirm}
        title={localize('com_admin_bulk_ban')}
        message={`Ban ${selectedIds.size} selected users for 24 hours?`}
        confirmLabel={localize('com_admin_bulk_ban')}
        variant="danger"
        onConfirm={confirmBulkBan}
        onCancel={() => setBulkBanConfirm(false)}
      />

      <ConfirmDialog
        open={bulkDeleteConfirm}
        title={localize('com_admin_bulk_delete')}
        message={`Permanently delete ${selectedIds.size} selected users? This cannot be undone.`}
        confirmLabel={localize('com_admin_bulk_delete')}
        variant="danger"
        onConfirm={confirmBulkDelete}
        onCancel={() => setBulkDeleteConfirm(false)}
      />

      <ConfirmDialog
        open={bulkRoleConfirm}
        title={localize('com_admin_bulk_change_role')}
        message={`Change role for ${selectedIds.size} selected users?`}
        confirmLabel={localize('com_admin_bulk_change_role')}
        variant="default"
        onConfirm={confirmBulkRole}
        onCancel={() => setBulkRoleConfirm(false)}
      >
        <select
          value={bulkRole}
          onChange={(e) => setBulkRole(e.target.value)}
          className="mt-3 w-full rounded-lg border border-border-light bg-surface-secondary px-3 py-2 text-sm text-text-primary"
        >
          <option value={SystemRoles.USER}>User</option>
          <option value={SystemRoles.ADMIN}>Admin</option>
        </select>
      </ConfirmDialog>
    </div>
  );
}
