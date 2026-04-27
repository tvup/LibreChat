import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SystemRoles, QueryKeys, dataService } from 'librechat-data-provider';
import {
  ArrowLeft,
  Save,
  Ban,
  KeyRound,
  Coins,
  Trash2,
  Shield,
  Mail,
  Smartphone,
  MessageSquare,
  FolderOpen,
  User,
  Activity,
  LogIn,
  Server,
} from 'lucide-react';
import {
  GoogleIcon,
  FacebookIcon,
  OpenIDIcon,
  GithubIcon,
  DiscordIcon,
  AppleIcon,
  SamlIcon,
} from '@librechat/client';
import { useImpersonate } from '~/components/Admin/useImpersonate';
import { ImageThumbnail, isImageType } from '~/components/Admin/ImagePreview';

import type { GalleryImage } from '~/components/Admin/ImagePreview';
import {
  useAdminUserDetail,
  useAdminUpdateUser,
  useAdminResetPassword,
  useAdminBanUser,
  useAdminUnbanUser,
  useAdminSetBalance,
  useAdminDeleteUser,
  useAdminConversations,
  useAdminFiles,
  useAdminDeleteConversation,
  useAdminDeleteFile,
} from '~/data-provider';
import { useAdminToast } from '~/components/Admin/useAdminToast';
import ConfirmDialog from '~/components/Admin/ConfirmDialog';
import { useLocalize } from '~/hooks';

import type { AdminUserDetail as AdminUserDetailType, AdminSocialMapping } from 'librechat-data-provider';

type TabId = 'info' | 'conversations' | 'files' | 'activity';

export default function AdminUserDetail() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const localize = useLocalize();
  const { showSuccess, showError } = useAdminToast();

  const { data: user, isLoading } = useAdminUserDetail(userId ?? '');
  const updateMutation = useAdminUpdateUser();
  const resetPasswordMutation = useAdminResetPassword();
  const banMutation = useAdminBanUser();
  const unbanMutation = useAdminUnbanUser();
  const setBalanceMutation = useAdminSetBalance();
  const deleteMutation = useAdminDeleteUser();
  const { impersonate } = useImpersonate();

  const [activeTab, setActiveTab] = useState<TabId>('info');
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editVerified, setEditVerified] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [balanceAmount, setBalanceAmount] = useState('');
  const [balanceMode, setBalanceMode] = useState<'add' | 'set'>('add');
  const [initialized, setInitialized] = useState(false);
  const [banDialog, setBanDialog] = useState(false);
  const [banMinutes, setBanMinutes] = useState('1440');
  const [deleteDialog, setDeleteDialog] = useState(false);

  if (user && !initialized) {
    setEditName(user.name ?? '');
    setEditEmail(user.email);
    setEditRole(user.role ?? SystemRoles.USER);
    setEditVerified(user.emailVerified);
    setInitialized(true);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-text-secondary">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-text-secondary">User not found</p>
      </div>
    );
  }

  const handleSave = () => {
    if (!userId) {
      return;
    }
    updateMutation.mutate(
      {
        userId,
        data: {
          name: editName,
          email: editEmail,
          role: editRole,
          emailVerified: editVerified,
        },
      },
      {
        onSuccess: () => showSuccess(localize('com_admin_toast_user_updated')),
        onError: () => showError(localize('com_admin_toast_error')),
      },
    );
  };

  const handleResetPassword = () => {
    if (!userId || newPassword.length < 8) {
      return;
    }
    resetPasswordMutation.mutate(
      { userId, data: { newPassword } },
      {
        onSuccess: () => {
          setNewPassword('');
          showSuccess(localize('com_admin_toast_password_reset'));
        },
        onError: () => showError(localize('com_admin_toast_error')),
      },
    );
  };

  const handleBan = () => {
    setBanDialog(true);
  };

  const confirmBan = () => {
    if (!userId) {
      return;
    }
    banMutation.mutate(
      { userId, data: { duration: Number(banMinutes) } },
      {
        onSuccess: () => showSuccess(localize('com_admin_toast_user_banned')),
        onError: () => showError(localize('com_admin_toast_error')),
      },
    );
    setBanDialog(false);
  };

  const handleSetBalance = () => {
    if (!userId || !balanceAmount) {
      return;
    }
    setBalanceMutation.mutate(
      { userId, data: { amount: Number(balanceAmount), mode: balanceMode } },
      { onSuccess: () => setBalanceAmount('') },
    );
  };

  const handleDelete = () => {
    setDeleteDialog(true);
  };

  const confirmDelete = () => {
    if (!userId) {
      return;
    }
    deleteMutation.mutate(userId, {
      onSuccess: () => {
        showSuccess(localize('com_admin_toast_user_deleted'));
        navigate('/admin/users');
      },
      onError: () => showError(localize('com_admin_toast_error')),
    });
    setDeleteDialog(false);
  };

  const tabs: Array<{ id: TabId; label: string; icon: React.ElementType }> = [
    { id: 'info', label: localize('com_admin_tab_info'), icon: User },
    { id: 'conversations', label: localize('com_admin_conversations'), icon: MessageSquare },
    { id: 'files', label: localize('com_admin_files'), icon: FolderOpen },
    { id: 'activity', label: localize('com_admin_tab_activity'), icon: Activity },
  ];

  const providerIds = [
    { key: 'googleId', label: 'Google', Icon: GoogleIcon },
    { key: 'openidId', label: 'OpenID', Icon: OpenIDIcon },
    { key: 'githubId', label: 'GitHub', Icon: GithubIcon },
    { key: 'discordId', label: 'Discord', Icon: DiscordIcon },
    { key: 'appleId', label: 'Apple', Icon: AppleIcon },
    { key: 'facebookId', label: 'Facebook', Icon: FacebookIcon },
    { key: 'samlId', label: 'SAML', Icon: SamlIcon },
    { key: 'ldapId', label: 'LDAP', Icon: Server },
  ] as const;

  return (
    <div className="p-6">
      <button
        onClick={() => navigate('/admin/users')}
        className="mb-4 flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary"
      >
        <ArrowLeft className="size-4" />
        Back to Users
      </button>

      {/* User Overview Card */}
      <div className="mb-6 rounded-xl border border-border-light bg-surface-secondary p-6">
        <div className="flex flex-wrap items-start gap-4">
          {user.avatar ? (
            <img src={user.avatar} alt="" className="size-16 rounded-full" />
          ) : (
            <div className="flex size-16 items-center justify-center rounded-full bg-surface-hover text-2xl font-medium text-text-secondary">
              {(user.name || user.email)[0]?.toUpperCase()}
            </div>
          )}
          <div className="flex-1">
            <h1 className="text-2xl font-semibold text-text-primary">
              {user.name || user.username || user.email}
            </h1>
            <p className="text-sm text-text-secondary">{user.email}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-500">
                <Shield className="size-3" />
                {user.role ?? SystemRoles.USER}
              </span>
              <span className="rounded-full bg-surface-hover px-2 py-0.5 text-xs text-text-secondary">
                {user.provider}
              </span>
              {user.emailVerified ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-500">
                  <Mail className="size-3" />
                  Verified
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-yellow-500/10 px-2 py-0.5 text-xs font-medium text-yellow-500">
                  <Mail className="size-3" />
                  Unverified
                </span>
              )}
              {user.twoFactorEnabled && (
                <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-500">
                  <Smartphone className="size-3" />
                  2FA
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <button
              onClick={() => userId && impersonate(userId)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-black transition-colors hover:bg-amber-600"
            >
              <LogIn className="size-3.5" />
              Impersonate
            </button>
            <div className="text-right text-xs text-text-secondary">
              {user.createdAt && (
                <p>Created: {new Date(user.createdAt).toLocaleDateString()}</p>
              )}
              {user.updatedAt && (
                <p>Updated: {new Date(user.updatedAt).toLocaleDateString()}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 border-b border-border-light">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm transition-colors ${
              activeTab === id
                ? 'border-green-500 font-medium text-text-primary'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'info' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-border-light bg-surface-secondary p-6">
            <h2 className="mb-4 text-lg font-medium text-text-primary">
              {localize('com_admin_user_management')}
            </h2>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs text-text-secondary">Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded-lg border border-border-light bg-surface-primary px-3 py-2 text-sm text-text-primary"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-text-secondary">Email</label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full rounded-lg border border-border-light bg-surface-primary px-3 py-2 text-sm text-text-primary"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-text-secondary">Role</label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  className="w-full rounded-lg border border-border-light bg-surface-primary px-3 py-2 text-sm text-text-primary"
                >
                  <option value={SystemRoles.USER}>User</option>
                  <option value={SystemRoles.ADMIN}>Admin</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="emailVerified"
                  checked={editVerified}
                  onChange={(e) => setEditVerified(e.target.checked)}
                  className="rounded"
                />
                <label htmlFor="emailVerified" className="text-sm text-text-primary">
                  Email Verified
                </label>
              </div>
              <button
                onClick={handleSave}
                disabled={updateMutation.isLoading}
                className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                <Save className="size-4" />
                {updateMutation.isLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-border-light bg-surface-secondary p-6">
              <h2 className="mb-3 flex items-center gap-2 text-lg font-medium text-text-primary">
                <KeyRound className="size-5" />
                {localize('com_admin_reset_password')}
              </h2>
              <div className="flex gap-2">
                <input
                  type="password"
                  placeholder="New password (min 8 chars)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="flex-1 rounded-lg border border-border-light bg-surface-primary px-3 py-2 text-sm text-text-primary"
                />
                <button
                  onClick={handleResetPassword}
                  disabled={resetPasswordMutation.isLoading || newPassword.length < 8}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  Reset
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-border-light bg-surface-secondary p-6">
              <h2 className="mb-3 flex items-center gap-2 text-lg font-medium text-text-primary">
                <Coins className="size-5" />
                Balance: {user.balance?.toLocaleString() ?? 0} credits
              </h2>
              <div className="flex gap-2">
                <select
                  value={balanceMode}
                  onChange={(e) => setBalanceMode(e.target.value as 'add' | 'set')}
                  className="rounded-lg border border-border-light bg-surface-primary px-3 py-2 text-sm text-text-primary"
                >
                  <option value="add">Add</option>
                  <option value="set">Set to</option>
                </select>
                <input
                  type="number"
                  placeholder="Amount"
                  value={balanceAmount}
                  onChange={(e) => setBalanceAmount(e.target.value)}
                  className="flex-1 rounded-lg border border-border-light bg-surface-primary px-3 py-2 text-sm text-text-primary"
                />
                <button
                  onClick={handleSetBalance}
                  disabled={setBalanceMutation.isLoading || !balanceAmount}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  Apply
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-border-light bg-surface-secondary p-6">
              <h2 className="mb-3 text-lg font-medium text-text-primary">Danger Zone</h2>
              <div className="flex gap-2">
                <button
                  onClick={handleBan}
                  className="flex items-center gap-2 rounded-lg border border-yellow-500 px-4 py-2 text-sm font-medium text-yellow-500 hover:bg-yellow-500/10"
                >
                  <Ban className="size-4" />
                  {localize('com_admin_ban_user')}
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleteMutation.isLoading}
                  className="flex items-center gap-2 rounded-lg border border-red-500 px-4 py-2 text-sm font-medium text-red-500 hover:bg-red-500/10 disabled:opacity-50"
                >
                  <Trash2 className="size-4" />
                  Delete User
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'conversations' && userId && <UserConversationsTab userId={userId} />}
      {activeTab === 'files' && userId && <UserFilesTab userId={userId} />}
      {activeTab === 'activity' && (
        <>
          <UserActivityTab user={user} providerIds={providerIds} />
          {userId && <SocialMappingsSection userId={userId} />}
        </>
      )}

      {/* Ban Dialog */}
      <ConfirmDialog
        open={banDialog}
        title={localize('com_admin_ban_user')}
        message="Enter ban duration in minutes (default: 1440 = 24 hours)"
        confirmLabel={localize('com_admin_ban_user')}
        variant="danger"
        onConfirm={confirmBan}
        onCancel={() => setBanDialog(false)}
      />

      {/* Delete Dialog */}
      <ConfirmDialog
        open={deleteDialog}
        title={localize('com_admin_confirm_delete')}
        message="This action cannot be undone. Type the user's email to confirm deletion."
        confirmLabel="Delete User"
        variant="danger"
        requireInput={user.email}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteDialog(false)}
      />
    </div>
  );
}

function UserConversationsTab({ userId }: { userId: string }) {
  const localize = useLocalize();
  const { showSuccess, showError } = useAdminToast();
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useAdminConversations({ userId, limit: 20 });
  const deleteMutation = useAdminDeleteConversation();
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; title: string } | null>(null);

  const conversations = data?.pages.flatMap((p) => p.data) ?? [];

  const handleDelete = (conversationId: string, title: string) => {
    setDeleteConfirm({ id: conversationId, title });
  };

  const confirmDelete = () => {
    if (!deleteConfirm) {
      return;
    }
    deleteMutation.mutate(deleteConfirm.id, {
      onSuccess: () => showSuccess(localize('com_admin_toast_conversation_deleted')),
      onError: () => showError(localize('com_admin_toast_error')),
    });
    setDeleteConfirm(null);
  };

  if (isLoading) {
    return <p className="text-text-secondary">Loading conversations...</p>;
  }

  if (conversations.length === 0) {
    return (
      <div className="rounded-xl border border-border-light bg-surface-secondary py-12 text-center">
        <MessageSquare className="mx-auto mb-3 size-10 text-text-secondary opacity-40" />
        <p className="text-sm text-text-secondary">{localize('com_admin_no_conversations')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {conversations.map((convo) => (
        <div
          key={convo.conversationId}
          className="flex items-center justify-between rounded-lg border border-border-light bg-surface-secondary p-3"
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-text-primary">{convo.title}</p>
            <div className="mt-0.5 flex gap-3 text-xs text-text-secondary">
              {convo.endpoint && <span>{convo.endpoint}</span>}
              {convo.model && <span>{convo.model}</span>}
              <span>{new Date(convo.updatedAt).toLocaleDateString()}</span>
            </div>
          </div>
          <button
            onClick={() => handleDelete(convo.conversationId, convo.title)}
            disabled={deleteMutation.isLoading}
            className="ml-2 rounded p-1.5 text-red-500 hover:bg-red-500/10"
            aria-label="Delete conversation"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      ))}
      {hasNextPage && (
        <button
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
          className="w-full rounded-lg border border-border-light py-2 text-sm text-text-secondary hover:bg-surface-hover"
        >
          {isFetchingNextPage ? 'Loading...' : localize('com_admin_load_more')}
        </button>
      )}
      <ConfirmDialog
        open={deleteConfirm !== null}
        title={localize('com_admin_delete_conversation')}
        message={`Delete conversation "${deleteConfirm?.title ?? ''}"?`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  );
}

function UserFilesTab({ userId }: { userId: string }) {
  const localize = useLocalize();
  const { showSuccess, showError } = useAdminToast();
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useAdminFiles({ userId, limit: 20 });
  const deleteMutation = useAdminDeleteFile();
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);

  const files = data?.pages.flatMap((p) => p.data) ?? [];

  const { galleryImages, galleryIndexMap } = React.useMemo(() => {
    const images: GalleryImage[] = [];
    const indexMap = new Map<string, number>();
    for (const file of files) {
      if (isImageType(file.type, file.filename)) {
        indexMap.set(file._id, images.length);
        images.push({ src: file.filepath, alt: file.filename, fileId: file.file_id });
      }
    }
    return { galleryImages: images, galleryIndexMap: indexMap };
  }, [files]);

  const handleGalleryDelete = (fileId: string) => {
    deleteMutation.mutate(fileId, {
      onSuccess: () => showSuccess(localize('com_admin_toast_file_deleted')),
      onError: () => showError(localize('com_admin_toast_error')),
    });
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) {
      return `${bytes} B`;
    }
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleDelete = (fileId: string, filename: string) => {
    setDeleteConfirm({ id: fileId, name: filename });
  };

  const confirmDelete = () => {
    if (!deleteConfirm) {
      return;
    }
    deleteMutation.mutate(deleteConfirm.id, {
      onSuccess: () => showSuccess(localize('com_admin_toast_file_deleted')),
      onError: () => showError(localize('com_admin_toast_error')),
    });
    setDeleteConfirm(null);
  };

  if (isLoading) {
    return <p className="text-text-secondary">Loading files...</p>;
  }

  if (files.length === 0) {
    return (
      <div className="rounded-xl border border-border-light bg-surface-secondary py-12 text-center">
        <FolderOpen className="mx-auto mb-3 size-10 text-text-secondary opacity-40" />
        <p className="text-sm text-text-secondary">{localize('com_admin_no_files')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {files.map((file) => (
        <div
          key={file._id}
          className="flex items-center justify-between rounded-lg border border-border-light bg-surface-secondary p-3"
        >
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <ImageThumbnail
              src={file.filepath}
              alt={file.filename}
              type={file.type}
              filename={file.filename}
              galleryImages={galleryImages}
              galleryIndex={galleryIndexMap.get(file._id)}
              onDelete={handleGalleryDelete}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-text-primary">{file.filename}</p>
              <div className="mt-0.5 flex gap-3 text-xs text-text-secondary">
                <span>{file.type}</span>
                <span>{formatSize(file.size)}</span>
                <span>{new Date(file.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
          <button
            onClick={() => handleDelete(file.file_id, file.filename)}
            disabled={deleteMutation.isLoading}
            className="ml-2 rounded p-1.5 text-red-500 hover:bg-red-500/10"
            aria-label="Delete file"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      ))}
      {hasNextPage && (
        <button
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
          className="w-full rounded-lg border border-border-light py-2 text-sm text-text-secondary hover:bg-surface-hover"
        >
          {isFetchingNextPage ? 'Loading...' : localize('com_admin_load_more')}
        </button>
      )}
      <ConfirmDialog
        open={deleteConfirm !== null}
        title={localize('com_admin_delete_file')}
        message={`Delete file "${deleteConfirm?.name ?? ''}"?`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  );
}

function UserActivityTab({
  user,
  providerIds,
}: {
  user: AdminUserDetailType;
  providerIds: ReadonlyArray<{ key: string; label: string; Icon: React.ComponentType<{ className?: string }> }>;
}) {
  const localize = useLocalize();

  const activeProviderIds = providerIds.filter(
    ({ key }) => user[key as keyof typeof user],
  );

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {activeProviderIds.length > 0 && (
        <div className="rounded-xl border border-border-light bg-surface-secondary p-6">
          <h3 className="mb-3 text-lg font-medium text-text-primary">
            {localize('com_admin_provider_ids')}
          </h3>
          <div className="space-y-2">
            {activeProviderIds.map(({ key, label, Icon }) => (
              <div key={key} className="flex items-center justify-between gap-3 text-sm">
                <span className="flex items-center gap-2 text-text-secondary">
                  <Icon className="size-4 shrink-0" />
                  {label}
                </span>
                <span className="truncate font-mono text-xs text-text-primary">
                  {String(user[key as keyof typeof user])}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-border-light bg-surface-secondary p-6">
        <h3 className="mb-3 text-lg font-medium text-text-primary">
          {localize('com_admin_account_status')}
        </h3>
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-text-secondary">Terms Accepted</span>
            <span className={user.termsAccepted ? 'text-green-500' : 'text-yellow-500'}>
              {user.termsAccepted ? 'Yes' : 'No'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-text-secondary">Memories Enabled</span>
            <span className="text-text-primary">
              {user.personalization?.memories !== false ? 'Yes' : 'No'}
            </span>
          </div>
        </div>
      </div>

      {user.plugins && user.plugins.length > 0 && (
        <div className="rounded-xl border border-border-light bg-surface-secondary p-6">
          <h3 className="mb-3 text-lg font-medium text-text-primary">
            {localize('com_admin_plugins')}
          </h3>
          <div className="flex flex-wrap gap-2">
            {user.plugins.map((plugin) => (
              <span
                key={plugin}
                className="rounded-full bg-surface-hover px-2.5 py-1 text-xs text-text-primary"
              >
                {plugin}
              </span>
            ))}
          </div>
        </div>
      )}

      {user.favorites && user.favorites.length > 0 && (
        <div className="rounded-xl border border-border-light bg-surface-secondary p-6">
          <h3 className="mb-3 text-lg font-medium text-text-primary">
            {localize('com_admin_favorites')}
          </h3>
          <div className="space-y-1">
            {user.favorites.map((fav, i) => (
              <div
                key={i}
                className="flex gap-2 rounded bg-surface-primary px-2 py-1 text-xs text-text-primary"
              >
                {fav.endpoint && <span>{fav.endpoint}</span>}
                {fav.model && <span>{fav.model}</span>}
                {fav.agentId && <span>{fav.agentId}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SocialMappingsSection({ userId }: { userId: string }) {
  const localize = useLocalize();
  const { showSuccess, showError } = useAdminToast();
  const queryClient = useQueryClient();

  const { data: mappings, isLoading } = useQuery<AdminSocialMapping[]>(
    [QueryKeys.adminSocialMappings, userId],
    () => dataService.getAdminSocialMappingsForUser(userId),
    { refetchOnWindowFocus: false },
  );

  const createMutation = useMutation(
    (data: { socialEmail: string; provider: string; targetUserId: string }) =>
      dataService.createAdminSocialMapping(data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries([QueryKeys.adminSocialMappings, userId]);
        showSuccess('Social mapping created');
      },
      onError: () => showError('Failed to create mapping'),
    },
  );

  const deleteMutation = useMutation(
    (id: string) => dataService.deleteAdminSocialMapping(id),
    {
      onSuccess: () => {
        queryClient.invalidateQueries([QueryKeys.adminSocialMappings, userId]);
        showSuccess('Social mapping deleted');
      },
      onError: () => showError('Failed to delete mapping'),
    },
  );

  const [showForm, setShowForm] = useState(false);
  const [socialEmail, setSocialEmail] = useState('');
  const [provider, setProvider] = useState('google');

  const handleCreate = () => {
    if (!socialEmail.trim()) {
      return;
    }
    createMutation.mutate({ socialEmail, provider, targetUserId: userId });
    setSocialEmail('');
    setShowForm(false);
  };

  const providers = [
    { value: 'google', label: 'Google' },
    { value: 'github', label: 'GitHub' },
    { value: 'discord', label: 'Discord' },
    { value: 'facebook', label: 'Facebook' },
    { value: 'apple', label: 'Apple' },
    { value: 'openid', label: 'OpenID' },
  ];

  return (
    <div className="mt-6 rounded-xl border border-border-light bg-surface-secondary p-6">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-medium text-text-primary">
          {localize('com_admin_social_mappings')}
        </h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
        >
          + Add Mapping
        </button>
      </div>
      <p className="mb-3 text-xs text-text-secondary">
        Pre-link a social login email to this account. When someone logs in with that email via the specified provider, they will be linked to this user.
      </p>

      {showForm && (
        <div className="mb-4 flex flex-wrap gap-2 rounded-lg border border-border-light bg-surface-primary p-3">
          <input
            type="email"
            placeholder="Social login email..."
            value={socialEmail}
            onChange={(e) => setSocialEmail(e.target.value)}
            className="flex-1 rounded-lg border border-border-light bg-surface-secondary px-3 py-1.5 text-sm text-text-primary"
          />
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            className="rounded-lg border border-border-light bg-surface-secondary px-3 py-1.5 text-sm text-text-primary"
          >
            {providers.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
          <button
            onClick={handleCreate}
            disabled={createMutation.isLoading || !socialEmail.trim()}
            className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            Save
          </button>
          <button
            onClick={() => setShowForm(false)}
            className="rounded-lg border border-border-light px-3 py-1.5 text-sm text-text-primary hover:bg-surface-hover"
          >
            Cancel
          </button>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-text-secondary">Loading...</p>
      ) : !mappings || mappings.length === 0 ? (
        <p className="text-sm text-text-secondary">No pre-linked social accounts</p>
      ) : (
        <div className="space-y-2">
          {mappings.map((m) => (
            <div
              key={m._id}
              className="flex items-center justify-between rounded-lg border border-border-light bg-surface-primary px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <span className="rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-medium capitalize text-blue-500">
                  {m.provider}
                </span>
                <span className="text-sm text-text-primary">{m.socialEmail}</span>
              </div>
              <button
                onClick={() => deleteMutation.mutate(m._id)}
                disabled={deleteMutation.isLoading}
                className="rounded p-1 text-red-500 hover:bg-red-500/10"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
