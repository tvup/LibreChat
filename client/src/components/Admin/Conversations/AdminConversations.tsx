import React, { useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Search, Trash2, MessageSquare, CalendarDays, TrendingUp, FileText, Type, ExternalLink } from 'lucide-react';
import { useAdminConversations, useAdminConversationStats, useAdminDeleteConversation } from '~/data-provider';
import { useAdminToast } from '~/components/Admin/useAdminToast';
import ConfirmDialog from '~/components/Admin/ConfirmDialog';
import { useLocalize } from '~/hooks';

import type { AdminConversationItem } from 'librechat-data-provider';

function useDebounce(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value);
  React.useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function ConversationStatCard({
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
              {value.toLocaleString()}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminConversations() {
  const localize = useLocalize();
  const { showSuccess, showError } = useAdminToast();
  const [searchInput, setSearchInput] = useState('');
  const [searchMode, setSearchMode] = useState<'title' | 'content'>('title');
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; title: string } | null>(null);
  const debouncedSearch = useDebounce(searchInput, 300);

  const params = useMemo(
    () => ({
      search: searchMode === 'title' ? debouncedSearch || undefined : undefined,
      contentSearch: searchMode === 'content' ? debouncedSearch || undefined : undefined,
      limit: 25,
    }),
    [debouncedSearch, searchMode],
  );

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useAdminConversations(params);
  const { data: stats, isLoading: statsLoading } = useAdminConversationStats();
  const deleteMutation = useAdminDeleteConversation();

  const conversations = useMemo(
    () => data?.pages.flatMap((page) => page.data) ?? [],
    [data],
  );

  const totalCount = data?.pages[0]?.pagination.totalCount ?? 0;

  const handleDelete = useCallback(
    (conversationId: string, title: string) => {
      setDeleteConfirm({ id: conversationId, title });
    },
    [],
  );

  const confirmDelete = useCallback(() => {
    if (!deleteConfirm) {
      return;
    }
    deleteMutation.mutate(deleteConfirm.id, {
      onSuccess: () => showSuccess(localize('com_admin_toast_conversation_deleted')),
      onError: () => showError(localize('com_admin_toast_error')),
    });
    setDeleteConfirm(null);
  }, [deleteConfirm, deleteMutation, showSuccess, showError, localize]);

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-semibold text-text-primary">
        {localize('com_admin_conversations')}
      </h1>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <ConversationStatCard
          icon={MessageSquare}
          label={localize('com_admin_total_conversations')}
          value={stats?.totalConversations ?? 0}
          loading={statsLoading}
        />
        <ConversationStatCard
          icon={CalendarDays}
          label={localize('com_admin_conversations_today')}
          value={stats?.conversationsToday ?? 0}
          loading={statsLoading}
        />
        <ConversationStatCard
          icon={TrendingUp}
          label={localize('com_admin_conversations_week')}
          value={stats?.conversationsThisWeek ?? 0}
          loading={statsLoading}
        />
      </div>

      <div className="mb-4">
        <div className="mb-2 flex items-center gap-2">
          <button
            onClick={() => setSearchMode('title')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              searchMode === 'title'
                ? 'bg-green-600 text-white'
                : 'bg-surface-secondary text-text-secondary hover:bg-surface-hover'
            }`}
          >
            <Type className="size-3" />
            {localize('com_admin_search_title')}
          </button>
          <button
            onClick={() => setSearchMode('content')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              searchMode === 'content'
                ? 'bg-green-600 text-white'
                : 'bg-surface-secondary text-text-secondary hover:bg-surface-hover'
            }`}
          >
            <FileText className="size-3" />
            {localize('com_admin_search_content')}
          </button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-secondary" />
          <input
            type="text"
            placeholder={
              searchMode === 'title'
                ? localize('com_admin_search_conversations')
                : localize('com_admin_search_message_content')
            }
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full rounded-lg border border-border-light bg-surface-secondary py-2 pl-10 pr-3 text-sm text-text-primary placeholder:text-text-secondary focus:border-border-heavy focus:outline-none"
          />
        </div>
      </div>

      <p className="mb-3 text-sm text-text-secondary">
        {totalCount} {localize('com_admin_conversations_total')}
      </p>

      <div className="overflow-x-auto rounded-lg border border-border-light">
        <table className="w-full text-sm">
          <thead className="border-b border-border-light bg-surface-secondary">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-text-secondary">Title</th>
              <th className="px-4 py-3 text-left font-medium text-text-secondary">User</th>
              <th className="px-4 py-3 text-left font-medium text-text-secondary">Endpoint / Model</th>
              <th className="px-4 py-3 text-left font-medium text-text-secondary">Created</th>
              <th className="px-4 py-3 text-right font-medium text-text-secondary">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-text-secondary">
                  Loading...
                </td>
              </tr>
            ) : conversations.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-text-secondary">
                  {localize('com_admin_no_conversations')}
                </td>
              </tr>
            ) : (
              conversations.map((conv: AdminConversationItem) => (
                <tr
                  key={conv.conversationId}
                  className="border-b border-border-light last:border-0 hover:bg-surface-hover"
                >
                  <td className="max-w-xs px-4 py-3">
                    <Link
                      to={`/c/${conv.conversationId}`}
                      className="group flex items-center gap-1.5 text-text-primary hover:text-green-500"
                    >
                      <span className="truncate">{conv.title || 'Untitled'}</span>
                      <ExternalLink className="size-3 flex-shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-text-primary">
                        {conv.user?.name || '-'}
                      </p>
                      <p className="text-xs text-text-secondary">
                        {conv.user?.email || '-'}
                      </p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-text-primary">{conv.endpoint || '-'}</p>
                      <p className="text-xs text-text-secondary">{conv.model || '-'}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-text-secondary">
                    {conv.createdAt ? new Date(conv.createdAt).toLocaleDateString() : '-'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(conv.conversationId, conv.title)}
                      disabled={deleteMutation.isLoading}
                      className="rounded p-1 text-red-500 hover:bg-red-500/10"
                      title={localize('com_admin_delete_conversation')}
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
            {isFetchingNextPage ? 'Loading...' : 'Load More'}
          </button>
        </div>
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
