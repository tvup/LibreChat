import React, { useCallback } from 'react';
import { Switch } from '@librechat/client';
import { PermissionTypes } from 'librechat-data-provider';
import type { UseMutationResult } from '@tanstack/react-query';
import type { TRole, TError, UpdatePermResponse } from 'librechat-data-provider';
import { useLocalize } from '~/hooks';
import {
  useGetRole,
  useUpdatePromptPermissionsMutation,
  useUpdateAgentPermissionsMutation,
  useUpdateMemoryPermissionsMutation,
  useUpdatePeoplePickerPermissionsMutation,
  useUpdateMCPServersPermissionsMutation,
  useUpdateMarketplacePermissionsMutation,
  useUpdateRemoteAgentsPermissionsMutation,
} from '~/data-provider';

type PermMutation = UseMutationResult<
  UpdatePermResponse,
  TError | undefined,
  { roleName: string; updates: Record<string, boolean> },
  unknown
>;

const EDITABLE_TYPES = new Set<string>([
  PermissionTypes.PROMPTS,
  PermissionTypes.AGENTS,
  PermissionTypes.MEMORIES,
  PermissionTypes.PEOPLE_PICKER,
  PermissionTypes.MCP_SERVERS,
  PermissionTypes.MARKETPLACE,
  PermissionTypes.REMOTE_AGENTS,
]);

const PERMISSION_TYPE_ORDER: Array<{ key: PermissionTypes; label: string }> = [
  { key: PermissionTypes.PROMPTS, label: 'Prompts' },
  { key: PermissionTypes.AGENTS, label: 'Agents' },
  { key: PermissionTypes.MEMORIES, label: 'Memories' },
  { key: PermissionTypes.MCP_SERVERS, label: 'MCP Servers' },
  { key: PermissionTypes.REMOTE_AGENTS, label: 'Remote Agents' },
  { key: PermissionTypes.PEOPLE_PICKER, label: 'People Picker' },
  { key: PermissionTypes.MARKETPLACE, label: 'Marketplace' },
  { key: PermissionTypes.BOOKMARKS, label: 'Bookmarks' },
  { key: PermissionTypes.MULTI_CONVO, label: 'Multi Convo' },
  { key: PermissionTypes.TEMPORARY_CHAT, label: 'Temporary Chat' },
  { key: PermissionTypes.RUN_CODE, label: 'Run Code' },
  { key: PermissionTypes.WEB_SEARCH, label: 'Web Search' },
  { key: PermissionTypes.FILE_SEARCH, label: 'File Search' },
  { key: PermissionTypes.FILE_CITATIONS, label: 'File Citations' },
];

function useMutationsMap(): Record<string, PermMutation> {
  const promptMutation = useUpdatePromptPermissionsMutation();
  const agentMutation = useUpdateAgentPermissionsMutation();
  const memoryMutation = useUpdateMemoryPermissionsMutation();
  const peoplePickerMutation = useUpdatePeoplePickerPermissionsMutation();
  const mcpServersMutation = useUpdateMCPServersPermissionsMutation();
  const marketplaceMutation = useUpdateMarketplacePermissionsMutation();
  const remoteAgentsMutation = useUpdateRemoteAgentsPermissionsMutation();

  return {
    [PermissionTypes.PROMPTS]: promptMutation as PermMutation,
    [PermissionTypes.AGENTS]: agentMutation as PermMutation,
    [PermissionTypes.MEMORIES]: memoryMutation as PermMutation,
    [PermissionTypes.PEOPLE_PICKER]: peoplePickerMutation as PermMutation,
    [PermissionTypes.MCP_SERVERS]: mcpServersMutation as PermMutation,
    [PermissionTypes.MARKETPLACE]: marketplaceMutation as PermMutation,
    [PermissionTypes.REMOTE_AGENTS]: remoteAgentsMutation as PermMutation,
  };
}

function PermissionToggle({
  checked,
  roleName,
  permKey,
  mutation,
}: {
  checked: boolean;
  roleName: string;
  permKey: string;
  mutation: PermMutation;
}) {
  const handleChange = useCallback(
    (value: boolean) => {
      mutation.mutate({ roleName, updates: { [permKey]: value } });
    },
    [mutation, roleName, permKey],
  );

  return (
    <Switch
      checked={checked}
      onCheckedChange={handleChange}
      disabled={mutation.isLoading}
      aria-label={`${permKey} permission toggle`}
    />
  );
}

function ReadOnlyBadge({ value }: { value: boolean }) {
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
        value
          ? 'bg-green-500/15 text-green-600 dark:text-green-400'
          : 'bg-red-500/15 text-red-600 dark:text-red-400'
      }`}
    >
      {value ? 'On' : 'Off'}
    </span>
  );
}

function PermissionGrid({
  roleName,
  roleData,
  mutations,
}: {
  roleName: string;
  roleData: TRole | undefined;
  mutations: Record<string, PermMutation>;
}) {
  if (!roleData) {
    return <div className="text-text-secondary py-4 text-center text-sm">Loading...</div>;
  }

  return (
    <div className="space-y-3">
      {PERMISSION_TYPE_ORDER.map(({ key, label }) => {
        const permObj = roleData.permissions[key] as Record<string, boolean> | undefined;
        if (!permObj) {
          return null;
        }

        const entries = Object.entries(permObj);
        if (entries.length === 0) {
          return null;
        }

        const isEditable = EDITABLE_TYPES.has(key);
        const mutation = mutations[key];

        return (
          <div
            key={key}
            className="bg-surface-primary rounded-lg border border-border-light px-4 py-3"
          >
            <div className="mb-2 flex items-center gap-2">
              <h4 className="text-text-primary text-sm font-semibold">{label}</h4>
              {!isEditable && (
                <span className="text-text-tertiary rounded bg-surface-secondary px-1.5 py-0.5 text-xs">
                  read-only
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3 md:grid-cols-4">
              {entries.map(([permKey, value]) => (
                <div key={permKey} className="flex items-center justify-between gap-2">
                  <span className="text-text-secondary text-xs">{permKey}</span>
                  {isEditable && mutation ? (
                    <PermissionToggle
                      checked={value}
                      roleName={roleName}
                      permKey={permKey}
                      mutation={mutation}
                    />
                  ) : (
                    <ReadOnlyBadge value={value} />
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RoleSection({
  roleName,
  roleLabel,
  mutations,
}: {
  roleName: string;
  roleLabel: string;
  mutations: Record<string, PermMutation>;
}) {
  const { data: roleData } = useGetRole(roleName);

  return (
    <div className="rounded-xl border border-border-light bg-surface-secondary p-6">
      <h2 className="text-text-primary mb-4 text-lg font-medium">{roleLabel}</h2>
      <PermissionGrid roleName={roleName} roleData={roleData} mutations={mutations} />
    </div>
  );
}

export default function AdminRolePermissions() {
  const localize = useLocalize();
  const mutations = useMutationsMap();

  return (
    <div className="p-6">
      <h1 className="text-text-primary mb-6 text-2xl font-semibold">
        {localize('com_admin_roles')}
      </h1>
      <div className="space-y-6">
        <RoleSection roleName="ADMIN" roleLabel="Admin Role" mutations={mutations} />
        <RoleSection roleName="USER" roleLabel="User Role" mutations={mutations} />
      </div>
    </div>
  );
}
