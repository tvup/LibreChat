import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  PermissionTypes,
  QueryKeys,
  dataService,
  agentPermissionsSchema,
  marketplacePermissionsSchema,
  mcpServersPermissionsSchema,
  memoryPermissionsSchema,
  peoplePickerPermissionsSchema,
  promptPermissionsSchema,
  remoteAgentsPermissionsSchema,
  skillPermissionsSchema,
} from 'librechat-data-provider';
import type {
  QueryObserverResult,
  UseMutationResult,
  UseQueryOptions,
} from '@tanstack/react-query';
import type * as t from 'librechat-data-provider';

export const useGetRole = (
  roleName: string,
  config?: UseQueryOptions<t.TRole>,
): QueryObserverResult<t.TRole> => {
  return useQuery<t.TRole>([QueryKeys.roles, roleName], () => dataService.getRole(roleName), {
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    retry: false,
    ...config,
  });
};

export const useListRoles = (
  config?: UseQueryOptions<t.ListRolesResponse>,
): QueryObserverResult<t.ListRolesResponse> => {
  return useQuery<t.ListRolesResponse>([QueryKeys.rolesList], () => dataService.listRoles(), {
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    retry: false,
    ...config,
  });
};

/**
 * Adapter for de tidligere syv per-type-mutations: den nye unified
 * /api/admin/roles/:name/permissions handler merger partial bodies, så
 * vi kan sende `{ permissions: { [type]: updates } }` og kun røre én type.
 */
type AnyPermVars = { roleName: string; updates: Record<string, boolean> };
type AnyPermOptions = {
  onMutate?: (variables: AnyPermVars) => unknown;
  onSuccess?: (data: t.UpdatePermResponse, variables: AnyPermVars, context: unknown) => unknown;
  onError?: (
    error: t.TError | undefined,
    variables: AnyPermVars,
    context: unknown,
  ) => unknown;
};

function buildPermissionMutation<TVars extends AnyPermVars>(
  permissionType: PermissionTypes,
  schema: { partial: () => { parse: (data: unknown) => unknown } },
  errorLabel: string,
  options?: AnyPermOptions,
): UseMutationResult<t.UpdatePermResponse, t.TError | undefined, TVars, unknown> {
  const queryClient = useQueryClient();
  const { onMutate, onSuccess, onError } = options ?? {};
  return useMutation<t.UpdatePermResponse, t.TError | undefined, TVars, unknown>(
    (variables) => {
      schema.partial().parse(variables.updates);
      return dataService.updateRolePermissions({
        roleName: variables.roleName,
        permissions: { [permissionType]: variables.updates },
      });
    },
    {
      onSuccess: (data, variables, context) => {
        queryClient.invalidateQueries([QueryKeys.roles, variables.roleName]);
        onSuccess?.(data, variables, context);
      },
      onError: (error, variables, context) => {
        if (error != null) {
          console.error(`Failed to update ${errorLabel} permissions:`, error);
        }
        onError?.(error, variables, context);
      },
      onMutate,
    },
  );
}

export const useUpdatePromptPermissionsMutation = (options?: t.UpdatePromptPermOptions) =>
  buildPermissionMutation<t.UpdatePromptPermVars>(
    PermissionTypes.PROMPTS,
    promptPermissionsSchema,
    'prompt',
    options,
  );

export const useUpdateAgentPermissionsMutation = (options?: t.UpdateAgentPermOptions) =>
  buildPermissionMutation<t.UpdateAgentPermVars>(
    PermissionTypes.AGENTS,
    agentPermissionsSchema,
    'agent',
    options,
  );

export const useUpdateMemoryPermissionsMutation = (options?: t.UpdateMemoryPermOptions) =>
  buildPermissionMutation<t.UpdateMemoryPermVars>(
    PermissionTypes.MEMORIES,
    memoryPermissionsSchema,
    'memory',
    options,
  );

export const useUpdateSkillPermissionsMutation = (options?: t.UpdateSkillPermOptions) =>
  buildPermissionMutation<t.UpdateSkillPermVars>(
    PermissionTypes.SKILLS,
    skillPermissionsSchema,
    'skill',
    options,
  );

export const useUpdatePeoplePickerPermissionsMutation = (
  options?: t.UpdatePeoplePickerPermOptions,
) =>
  buildPermissionMutation<t.UpdatePeoplePickerPermVars>(
    PermissionTypes.PEOPLE_PICKER,
    peoplePickerPermissionsSchema,
    'people picker',
    options,
  );

export const useUpdateMCPServersPermissionsMutation = (options?: t.UpdateMCPServersPermOptions) =>
  buildPermissionMutation<t.UpdateMCPServersPermVars>(
    PermissionTypes.MCP_SERVERS,
    mcpServersPermissionsSchema,
    'MCP servers',
    options,
  );

export const useUpdateMarketplacePermissionsMutation = (
  options?: t.UpdateMarketplacePermOptions,
) =>
  buildPermissionMutation<t.UpdateMarketplacePermVars>(
    PermissionTypes.MARKETPLACE,
    marketplacePermissionsSchema,
    'marketplace',
    options,
  );

export const useUpdateRemoteAgentsPermissionsMutation = (
  options?: t.UpdateRemoteAgentsPermOptions,
) =>
  buildPermissionMutation<t.UpdateRemoteAgentsPermVars>(
    PermissionTypes.REMOTE_AGENTS,
    remoteAgentsPermissionsSchema,
    'remote agents',
    options,
  );
