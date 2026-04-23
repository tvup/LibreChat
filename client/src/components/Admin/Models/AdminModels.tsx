import React, { useState, useMemo, useCallback } from 'react';
import { Switch } from '@librechat/client';
import { ChevronDown, ChevronRight, Search } from 'lucide-react';
import { useLocalize } from '~/hooks';
import { useAdminModels, useAdminToggleModel, useAdminBulkModels } from '~/data-provider/Admin';

import type { AdminModelItem } from 'librechat-data-provider';

export default function AdminModels() {
  const localize = useLocalize();
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedEndpoints, setCollapsedEndpoints] = useState<Set<string>>(new Set());

  const { data: modelsConfig, isLoading, isError } = useAdminModels();
  const toggleMutation = useAdminToggleModel();
  const bulkMutation = useAdminBulkModels();

  const filteredConfig = useMemo(() => {
    if (!modelsConfig) {
      return {};
    }
    if (!searchQuery.trim()) {
      return modelsConfig;
    }
    const query = searchQuery.toLowerCase();
    const result: Record<string, AdminModelItem[]> = {};
    for (const [endpoint, models] of Object.entries(modelsConfig)) {
      const filtered = models.filter((m) => m.model.toLowerCase().includes(query));
      if (filtered.length > 0) {
        result[endpoint] = filtered;
      }
    }
    return result;
  }, [modelsConfig, searchQuery]);

  const toggleEndpointCollapse = useCallback((endpoint: string) => {
    setCollapsedEndpoints((prev) => {
      const next = new Set(prev);
      if (next.has(endpoint)) {
        next.delete(endpoint);
      } else {
        next.add(endpoint);
      }
      return next;
    });
  }, []);

  const handleToggle = useCallback(
    (endpoint: string, model: string, currentEnabled: boolean) => {
      toggleMutation.mutate({ endpoint, model, disabled: currentEnabled });
    },
    [toggleMutation],
  );

  const handleEnableAll = useCallback(
    (endpoint: string) => {
      bulkMutation.mutate({ endpoint, disabledModels: [] });
    },
    [bulkMutation],
  );

  const handleDisableAll = useCallback(
    (endpoint: string) => {
      if (!modelsConfig) {
        return;
      }
      const allModels = modelsConfig[endpoint]?.map((m) => m.model) ?? [];
      bulkMutation.mutate({ endpoint, disabledModels: allModels });
    },
    [bulkMutation, modelsConfig],
  );

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-text-secondary">{localize('com_ui_loading')}</div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-red-500">{localize('com_admin_toast_error')}</div>
      </div>
    );
  }

  const endpoints = Object.entries(filteredConfig);

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-bold text-text-primary">
        {localize('com_admin_models')}
      </h1>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-secondary" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={localize('com_admin_search_models')}
          className="w-full rounded-lg border border-border-light bg-surface-secondary py-2 pl-10 pr-4 text-sm text-text-primary placeholder-text-secondary focus:border-border-heavy focus:outline-none"
        />
      </div>

      {endpoints.length === 0 && (
        <div className="flex h-32 items-center justify-center text-text-secondary">
          {localize('com_admin_no_model_data')}
        </div>
      )}

      <div className="space-y-4">
        {endpoints.map(([endpoint, models]) => {
          const enabledCount = models.filter((m) => m.enabled).length;
          const totalCount = models.length;
          const isCollapsed = collapsedEndpoints.has(endpoint);

          return (
            <div
              key={endpoint}
              className="overflow-hidden rounded-lg border border-border-light bg-surface-secondary"
            >
              <div className="flex items-center justify-between border-b border-border-light px-4 py-3">
                <button
                  type="button"
                  onClick={() => toggleEndpointCollapse(endpoint)}
                  className="flex items-center gap-2 text-left"
                  aria-expanded={!isCollapsed}
                  aria-label={`${endpoint} section`}
                >
                  {isCollapsed ? (
                    <ChevronRight className="size-4 text-text-secondary" />
                  ) : (
                    <ChevronDown className="size-4 text-text-secondary" />
                  )}
                  <h2 className="text-lg font-semibold text-text-primary">{endpoint}</h2>
                  <span className="text-sm text-text-secondary">
                    ({enabledCount}/{totalCount} {localize('com_admin_models_enabled')})
                  </span>
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleEnableAll(endpoint)}
                    disabled={bulkMutation.isLoading}
                    className="rounded-md border border-border-light px-3 py-1 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary disabled:opacity-50"
                  >
                    {localize('com_admin_enable_all')}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDisableAll(endpoint)}
                    disabled={bulkMutation.isLoading}
                    className="rounded-md border border-border-light px-3 py-1 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary disabled:opacity-50"
                  >
                    {localize('com_admin_disable_all')}
                  </button>
                </div>
              </div>

              {!isCollapsed && (
                <div className="divide-y divide-border-light">
                  {models.map((item) => (
                    <div
                      key={`${endpoint}-${item.model}`}
                      className="flex items-center justify-between px-4 py-2.5 transition-colors hover:bg-surface-hover"
                    >
                      <span
                        className={`text-sm font-mono ${
                          item.enabled ? 'text-text-primary' : 'text-text-secondary line-through'
                        }`}
                      >
                        {item.model}
                      </span>
                      <Switch
                        checked={item.enabled}
                        onCheckedChange={() => handleToggle(endpoint, item.model, item.enabled)}
                        aria-label={`Toggle ${item.model}`}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
