import React, { useState } from 'react';
import { Plus, Trash2, Eye, Megaphone, X } from 'lucide-react';
import {
  useAdminBanners,
  useAdminCreateBanner,
  useAdminUpdateBanner,
  useAdminDeleteBanner,
} from '~/data-provider';
import { useAdminToast } from '~/components/Admin/useAdminToast';
import ConfirmDialog from '~/components/Admin/ConfirmDialog';
import { useLocalize } from '~/hooks';

import type { AdminBannerItem } from 'librechat-data-provider';

type BannerFormData = {
  message: string;
  displayFrom: string;
  displayTo: string;
  type: 'banner' | 'popup';
  isPublic: boolean;
  persistable: boolean;
};

const emptyForm: BannerFormData = {
  message: '',
  displayFrom: '',
  displayTo: '',
  type: 'banner',
  isPublic: false,
  persistable: false,
};

function toLocalDatetime(iso: string): string {
  if (!iso) {
    return '';
  }
  const d = new Date(iso);
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 16);
}

function getBannerStatus(displayFrom: string, displayTo?: string) {
  const now = new Date();
  const from = new Date(displayFrom);
  const to = displayTo ? new Date(displayTo) : null;

  if (from > now) {
    return { label: 'Scheduled', className: 'bg-blue-500/10 text-blue-500' };
  }
  if (to && to < now) {
    return { label: 'Expired', className: 'bg-gray-500/10 text-gray-500' };
  }
  return { label: 'Active', className: 'bg-green-500/10 text-green-500' };
}

export default function AdminBannerManagement() {
  const localize = useLocalize();
  const { showSuccess, showError } = useAdminToast();
  const { data: banners, isLoading } = useAdminBanners();
  const createMutation = useAdminCreateBanner();
  const updateMutation = useAdminUpdateBanner();
  const deleteMutation = useAdminDeleteBanner();

  const [showForm, setShowForm] = useState(false);
  const [editingBanner, setEditingBanner] = useState<AdminBannerItem | null>(null);
  const [form, setForm] = useState<BannerFormData>(emptyForm);
  const [showPreview, setShowPreview] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const openCreateForm = () => {
    setEditingBanner(null);
    setForm({
      ...emptyForm,
      displayFrom: toLocalDatetime(new Date().toISOString()),
    });
    setShowForm(true);
  };

  const openEditForm = (banner: AdminBannerItem) => {
    setEditingBanner(banner);
    setForm({
      message: banner.message,
      displayFrom: toLocalDatetime(banner.displayFrom),
      displayTo: banner.displayTo ? toLocalDatetime(banner.displayTo) : '',
      type: banner.type,
      isPublic: banner.isPublic,
      persistable: banner.persistable,
    });
    setShowForm(true);
  };

  const handleSubmit = () => {
    if (!form.message.trim()) {
      return;
    }

    const payload = {
      bannerId: editingBanner?.bannerId ?? `banner_${Date.now()}`,
      message: form.message,
      displayFrom: form.displayFrom
        ? new Date(form.displayFrom).toISOString()
        : new Date().toISOString(),
      displayTo: form.displayTo ? new Date(form.displayTo).toISOString() : undefined,
      type: form.type,
      isPublic: form.isPublic,
      persistable: form.persistable,
    };

    const onSuccess = () => {
      setForm(emptyForm);
      setShowForm(false);
      setEditingBanner(null);
      showSuccess(
        editingBanner
          ? localize('com_admin_toast_banner_updated')
          : localize('com_admin_toast_banner_created'),
      );
    };

    const onError = () => showError(localize('com_admin_toast_error'));

    if (editingBanner) {
      updateMutation.mutate(
        { bannerId: editingBanner.bannerId, data: payload },
        { onSuccess, onError },
      );
    } else {
      createMutation.mutate(payload, { onSuccess, onError });
    }
  };

  const handleDelete = (bannerId: string) => {
    setDeleteConfirm(bannerId);
  };

  const confirmDelete = () => {
    if (!deleteConfirm) {
      return;
    }
    deleteMutation.mutate(deleteConfirm, {
      onSuccess: () => showSuccess(localize('com_admin_toast_banner_deleted')),
      onError: () => showError(localize('com_admin_toast_error')),
    });
    setDeleteConfirm(null);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingBanner(null);
    setForm(emptyForm);
    setShowPreview(false);
  };

  const isSaving = createMutation.isLoading || updateMutation.isLoading;

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-text-primary">
          {localize('com_admin_banners')}
        </h1>
        <button
          onClick={openCreateForm}
          className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
        >
          <Plus className="size-4" />
          {localize('com_admin_new_banner')}
        </button>
      </div>

      {showForm && (
        <div className="mb-6 rounded-xl border border-border-light bg-surface-secondary p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-medium text-text-primary">
              {editingBanner ? localize('com_admin_edit_banner') : localize('com_admin_create_banner')}
            </h2>
            <button onClick={closeForm} className="text-text-secondary hover:text-text-primary">
              <X className="size-5" />
            </button>
          </div>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs text-text-secondary">
                {localize('com_admin_banner_message')}
              </label>
              <textarea
                placeholder="Banner message..."
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                rows={3}
                className="w-full rounded-lg border border-border-light bg-surface-primary px-3 py-2 text-sm text-text-primary"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-text-secondary">
                  {localize('com_admin_display_from')}
                </label>
                <input
                  type="datetime-local"
                  value={form.displayFrom}
                  onChange={(e) => setForm({ ...form, displayFrom: e.target.value })}
                  className="w-full rounded-lg border border-border-light bg-surface-primary px-3 py-2 text-sm text-text-primary"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-text-secondary">
                  {localize('com_admin_display_to')}
                </label>
                <input
                  type="datetime-local"
                  value={form.displayTo}
                  onChange={(e) => setForm({ ...form, displayTo: e.target.value })}
                  className="w-full rounded-lg border border-border-light bg-surface-primary px-3 py-2 text-sm text-text-primary"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-4">
              <div>
                <label className="mb-1 block text-xs text-text-secondary">
                  {localize('com_admin_banner_type')}
                </label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value as 'banner' | 'popup' })}
                  className="rounded-lg border border-border-light bg-surface-primary px-3 py-2 text-sm text-text-primary"
                >
                  <option value="banner">Banner</option>
                  <option value="popup">Popup</option>
                </select>
              </div>
              <label className="flex items-center gap-2 self-end pb-2 text-sm text-text-primary">
                <input
                  type="checkbox"
                  checked={form.isPublic}
                  onChange={(e) => setForm({ ...form, isPublic: e.target.checked })}
                  className="rounded"
                />
                {localize('com_admin_banner_public')}
              </label>
              <label className="flex items-center gap-2 self-end pb-2 text-sm text-text-primary">
                <input
                  type="checkbox"
                  checked={form.persistable}
                  onChange={(e) => setForm({ ...form, persistable: e.target.checked })}
                  className="rounded"
                />
                {localize('com_admin_banner_persistable')}
              </label>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleSubmit}
                disabled={isSaving || !form.message.trim()}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                {isSaving
                  ? (editingBanner ? 'Saving...' : 'Creating...')
                  : (editingBanner ? 'Save Changes' : 'Create')}
              </button>
              <button
                onClick={() => setShowPreview(!showPreview)}
                disabled={!form.message.trim()}
                className="flex items-center gap-2 rounded-lg border border-border-light px-4 py-2 text-sm text-text-primary hover:bg-surface-hover disabled:opacity-50"
              >
                <Eye className="size-4" />
                {localize('com_admin_banner_preview')}
              </button>
              <button
                onClick={closeForm}
                className="rounded-lg border border-border-light px-4 py-2 text-sm text-text-primary hover:bg-surface-hover"
              >
                Cancel
              </button>
            </div>

            {showPreview && form.message.trim() && (
              <div className="mt-2 rounded-lg border border-blue-300 bg-blue-50 p-4 dark:border-blue-700 dark:bg-blue-900/20">
                <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                  {localize('com_admin_banner_preview')}
                </p>
                <div className="mt-2 rounded-md bg-yellow-100 px-4 py-3 text-sm text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200">
                  {form.message}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="text-text-secondary">Loading banners...</p>
      ) : !banners || banners.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border-light bg-surface-secondary py-16">
          <Megaphone className="mb-4 size-12 text-text-secondary opacity-40" />
          <p className="mb-1 text-lg font-medium text-text-primary">
            {localize('com_admin_no_banners')}
          </p>
          <p className="text-sm text-text-secondary">
            {localize('com_admin_no_banners_description')}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {banners.map((banner) => {
            const status = getBannerStatus(banner.displayFrom, banner.displayTo);
            return (
              <div
                key={banner._id}
                className="flex items-center justify-between rounded-xl border border-border-light bg-surface-secondary p-4 transition-colors hover:bg-surface-hover"
              >
                <button
                  className="flex-1 cursor-pointer text-left"
                  onClick={() => openEditForm(banner)}
                >
                  <div className="mb-1 flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${status.className}`}
                    >
                      {status.label}
                    </span>
                    <span className="rounded bg-surface-primary px-1.5 py-0.5 text-xs text-text-secondary">
                      {banner.type}
                    </span>
                    {banner.isPublic && (
                      <span className="rounded bg-surface-primary px-1.5 py-0.5 text-xs text-text-secondary">
                        public
                      </span>
                    )}
                    {banner.persistable && (
                      <span className="rounded bg-surface-primary px-1.5 py-0.5 text-xs text-text-secondary">
                        persistable
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-text-primary">{banner.message}</p>
                  <p className="mt-1 text-xs text-text-secondary">
                    From: {new Date(banner.displayFrom).toLocaleString()}
                    {banner.displayTo &&
                      ` — To: ${new Date(banner.displayTo).toLocaleString()}`}
                  </p>
                </button>
                <button
                  onClick={() => handleDelete(banner.bannerId)}
                  disabled={deleteMutation.isLoading}
                  className="ml-4 rounded p-2 text-red-500 hover:bg-red-500/10"
                  aria-label="Delete banner"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={deleteConfirm !== null}
        title={localize('com_admin_confirm_delete')}
        message="Are you sure you want to delete this banner?"
        confirmLabel="Delete"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  );
}
