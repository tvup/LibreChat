import React, { useState, useMemo, useCallback } from 'react';
import { Search, Trash2, FileIcon, HardDrive, BarChart3 } from 'lucide-react';
import {
  useAdminFiles,
  useAdminFileStats,
  useAdminDeleteFile,
} from '~/data-provider';
import { ImageThumbnail, isImageType } from '~/components/Admin/ImagePreview';

import type { GalleryImage } from '~/components/Admin/ImagePreview';
import { useAdminToast } from '~/components/Admin/useAdminToast';
import ConfirmDialog from '~/components/Admin/ConfirmDialog';
import { useLocalize } from '~/hooks';

import type { AdminFileItem } from 'librechat-data-provider';

function useDebounce(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value);
  React.useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) {
    return '0 B';
  }
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const size = bytes / Math.pow(k, i);
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function FileStatCard({
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

export default function AdminFiles() {
  const localize = useLocalize();
  const { showSuccess, showError } = useAdminToast();
  const [searchInput, setSearchInput] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const debouncedSearch = useDebounce(searchInput, 300);

  const params = useMemo(
    () => ({
      search: debouncedSearch || undefined,
      limit: 25,
    }),
    [debouncedSearch],
  );

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useAdminFiles(params);
  const { data: stats, isLoading: statsLoading } = useAdminFileStats();
  const deleteMutation = useAdminDeleteFile();

  const files = useMemo(
    () => data?.pages.flatMap((page) => page.data) ?? [],
    [data],
  );

  const { galleryImages, galleryIndexMap } = useMemo(() => {
    const images: GalleryImage[] = [];
    const indexMap = new Map<string, number>();
    for (const file of files) {
      if (isImageType(file.type, file.filename)) {
        indexMap.set(file.file_id, images.length);
        images.push({ src: file.filepath, alt: file.filename, fileId: file.file_id });
      }
    }
    return { galleryImages: images, galleryIndexMap: indexMap };
  }, [files]);

  const totalCount = data?.pages[0]?.pagination.totalCount ?? 0;

  const handleGalleryDelete = useCallback(
    (fileId: string) => {
      deleteMutation.mutate(fileId, {
        onSuccess: () => showSuccess(localize('com_admin_toast_file_deleted')),
        onError: () => showError(localize('com_admin_toast_error')),
      });
    },
    [deleteMutation, showSuccess, showError, localize],
  );

  const handleDelete = useCallback(
    (fileId: string, filename: string) => {
      setDeleteConfirm({ id: fileId, name: filename });
    },
    [],
  );

  const confirmDelete = useCallback(() => {
    if (!deleteConfirm) {
      return;
    }
    deleteMutation.mutate(deleteConfirm.id, {
      onSuccess: () => showSuccess(localize('com_admin_toast_file_deleted')),
      onError: () => showError(localize('com_admin_toast_error')),
    });
    setDeleteConfirm(null);
  }, [deleteConfirm, deleteMutation, showSuccess, showError, localize]);

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-semibold text-text-primary">
        {localize('com_admin_files')}
      </h1>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <FileStatCard
          icon={FileIcon}
          label={localize('com_admin_total_files')}
          value={stats?.totalFiles ?? 0}
          loading={statsLoading}
        />
        <FileStatCard
          icon={HardDrive}
          label={localize('com_admin_total_size')}
          value={formatFileSize(stats?.totalSize ?? 0)}
          loading={statsLoading}
        />
        <FileStatCard
          icon={BarChart3}
          label={localize('com_admin_file_types')}
          value={stats?.filesByType?.length ?? 0}
          loading={statsLoading}
        />
      </div>

      {stats?.filesByType && stats.filesByType.length > 0 && (
        <div className="mb-6 rounded-xl border border-border-light bg-surface-secondary p-4">
          <h2 className="mb-3 text-sm font-medium text-text-primary">
            {localize('com_admin_files_by_type')}
          </h2>
          <div className="flex flex-wrap gap-2">
            {stats.filesByType.map((item) => (
              <span
                key={item.type}
                className="rounded-full border border-border-light bg-surface-hover px-3 py-1 text-xs text-text-secondary"
              >
                {item.type}: {item.count} ({formatFileSize(item.totalSize)})
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-secondary" />
          <input
            type="text"
            placeholder={localize('com_admin_search_files')}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full rounded-lg border border-border-light bg-surface-secondary py-2 pl-10 pr-3 text-sm text-text-primary placeholder:text-text-secondary focus:border-border-heavy focus:outline-none"
          />
        </div>
      </div>

      <p className="mb-3 text-sm text-text-secondary">
        {totalCount} {localize('com_admin_files_total')}
      </p>

      <div className="overflow-x-auto rounded-lg border border-border-light">
        <table className="w-full text-sm">
          <thead className="border-b border-border-light bg-surface-secondary">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-text-secondary">
                {localize('com_admin_filename')}
              </th>
              <th className="px-4 py-3 text-left font-medium text-text-secondary">
                {localize('com_admin_file_type')}
              </th>
              <th className="px-4 py-3 text-left font-medium text-text-secondary">
                {localize('com_admin_file_size')}
              </th>
              <th className="px-4 py-3 text-left font-medium text-text-secondary">
                {localize('com_admin_file_user')}
              </th>
              <th className="px-4 py-3 text-left font-medium text-text-secondary">
                {localize('com_admin_file_created')}
              </th>
              <th className="px-4 py-3 text-right font-medium text-text-secondary">
                {localize('com_admin_file_actions')}
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-text-secondary">
                  Loading...
                </td>
              </tr>
            ) : files.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-text-secondary">
                  {localize('com_admin_no_files')}
                </td>
              </tr>
            ) : (
              files.map((file: AdminFileItem) => (
                <tr
                  key={file.file_id}
                  className="border-b border-border-light last:border-0 hover:bg-surface-hover"
                >
                  <td className="max-w-xs px-4 py-3 text-text-primary">
                    <div className="flex items-center gap-2">
                      <ImageThumbnail
                        src={file.filepath}
                        alt={file.filename}
                        type={file.type}
                        filename={file.filename}
                        galleryImages={galleryImages}
                        galleryIndex={galleryIndexMap.get(file.file_id)}
                        onDelete={handleGalleryDelete}
                      />
                      <span className="truncate">{file.filename}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{file.type}</td>
                  <td className="px-4 py-3 text-text-secondary">{formatFileSize(file.size)}</td>
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-text-primary">{file.user?.name || '-'}</p>
                      <p className="text-xs text-text-secondary">{file.user?.email || '-'}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-text-secondary">
                    {file.createdAt ? new Date(file.createdAt).toLocaleDateString() : '-'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(file.file_id, file.filename)}
                      disabled={deleteMutation.isLoading}
                      className="rounded p-1 text-red-500 hover:bg-red-500/10"
                      title={localize('com_admin_delete_file')}
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

      {hasNextPage && (
        <div className="mt-4 flex justify-center">
          <button
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="rounded-lg bg-surface-secondary px-4 py-2 text-sm text-text-primary hover:bg-surface-hover disabled:opacity-50"
          >
            {isFetchingNextPage ? 'Loading...' : localize('com_admin_load_more')}
          </button>
        </div>
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
