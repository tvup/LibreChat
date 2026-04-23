import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { QueryKeys, dataService } from 'librechat-data-provider';

import type { UseQueryOptions, UseInfiniteQueryOptions } from '@tanstack/react-query';
import type {
  AdminDashboardStats,
  AdminUserListParams,
  AdminUserListResponse,
  AdminUserDetail,
  AdminBannerItem,
  AdminConversationListResponse,
  AdminConversationStats,
  AdminFileListResponse,
  AdminFileStats,
  AdminActiveSession,
  AdminViolationSummary,
  AdminSystemInfo,
  AdminEndpointStats,
  AdminMCPServer,
  AdminMCPStats,
  AdminTokenStats,
  AdminModelsConfig,
} from 'librechat-data-provider';

export const useAdminDashboard = (config?: UseQueryOptions<AdminDashboardStats>) => {
  return useQuery<AdminDashboardStats>(
    [QueryKeys.adminDashboard],
    () => dataService.getAdminDashboard(),
    {
      refetchOnWindowFocus: false,
      retry: false,
      ...config,
    },
  );
};

export const useAdminUsers = (
  params: Omit<AdminUserListParams, 'cursor'>,
  config?: UseInfiniteQueryOptions<AdminUserListResponse>,
) => {
  return useInfiniteQuery<AdminUserListResponse>(
    [QueryKeys.adminUsers, params],
    ({ pageParam }) => dataService.getAdminUsers({ ...params, cursor: pageParam as string }),
    {
      getNextPageParam: (lastPage) =>
        lastPage.pagination.hasNextPage ? lastPage.pagination.nextCursor : undefined,
      refetchOnWindowFocus: false,
      retry: false,
      ...config,
    },
  );
};

export const useAdminUserDetail = (
  userId: string,
  config?: UseQueryOptions<AdminUserDetail>,
) => {
  return useQuery<AdminUserDetail>(
    [QueryKeys.adminUserDetail, userId],
    () => dataService.getAdminUserById(userId),
    {
      enabled: !!userId,
      refetchOnWindowFocus: false,
      retry: false,
      ...config,
    },
  );
};

export const useAdminBanners = (config?: UseQueryOptions<AdminBannerItem[]>) => {
  return useQuery<AdminBannerItem[]>(
    [QueryKeys.adminBanners],
    () => dataService.getAdminBanners(),
    {
      refetchOnWindowFocus: false,
      retry: false,
      ...config,
    },
  );
};

export const useAdminConversations = (
  params: { search?: string; contentSearch?: string; limit?: number; userId?: string },
  config?: UseInfiniteQueryOptions<AdminConversationListResponse>,
) => {
  return useInfiniteQuery<AdminConversationListResponse>(
    [QueryKeys.adminConversations, params],
    ({ pageParam }) =>
      dataService.getAdminConversations({
        ...params,
        cursor: pageParam as string,
      }),
    {
      getNextPageParam: (lastPage) =>
        lastPage.pagination.hasNextPage ? lastPage.pagination.nextCursor : undefined,
      refetchOnWindowFocus: false,
      retry: false,
      ...config,
    },
  );
};

export const useAdminConversationStats = (
  config?: UseQueryOptions<AdminConversationStats>,
) => {
  return useQuery<AdminConversationStats>(
    [QueryKeys.adminConversationStats],
    () => dataService.getAdminConversationStats(),
    {
      refetchOnWindowFocus: false,
      retry: false,
      ...config,
    },
  );
};

export const useAdminFiles = (
  params: { search?: string; limit?: number; userId?: string },
  config?: UseInfiniteQueryOptions<AdminFileListResponse>,
) => {
  return useInfiniteQuery<AdminFileListResponse>(
    [QueryKeys.adminFiles, params],
    ({ pageParam }) =>
      dataService.getAdminFiles({
        ...params,
        cursor: pageParam as string,
      }),
    {
      getNextPageParam: (lastPage) =>
        lastPage.pagination.hasNextPage ? lastPage.pagination.nextCursor : undefined,
      refetchOnWindowFocus: false,
      retry: false,
      ...config,
    },
  );
};

export const useAdminFileStats = (config?: UseQueryOptions<AdminFileStats>) => {
  return useQuery<AdminFileStats>(
    [QueryKeys.adminFileStats],
    () => dataService.getAdminFileStats(),
    {
      refetchOnWindowFocus: false,
      retry: false,
      ...config,
    },
  );
};

export const useAdminSessions = (config?: UseQueryOptions<AdminActiveSession[]>) => {
  return useQuery<AdminActiveSession[]>(
    [QueryKeys.adminSessions],
    () => dataService.getAdminSessions(),
    {
      refetchOnWindowFocus: false,
      retry: false,
      ...config,
    },
  );
};

export const useAdminViolations = (config?: UseQueryOptions<AdminViolationSummary[]>) => {
  return useQuery<AdminViolationSummary[]>(
    [QueryKeys.adminViolations],
    () => dataService.getAdminViolations(),
    {
      refetchOnWindowFocus: false,
      retry: false,
      ...config,
    },
  );
};

export const useAdminSystemInfo = (config?: UseQueryOptions<AdminSystemInfo>) => {
  return useQuery<AdminSystemInfo>(
    [QueryKeys.adminSystemInfo],
    () => dataService.getAdminSystemInfo(),
    {
      refetchOnWindowFocus: false,
      retry: false,
      ...config,
    },
  );
};

export const useAdminEndpointStats = (config?: UseQueryOptions<AdminEndpointStats>) => {
  return useQuery<AdminEndpointStats>(
    [QueryKeys.adminEndpointStats],
    () => dataService.getAdminEndpointStats(),
    {
      refetchOnWindowFocus: false,
      retry: false,
      ...config,
    },
  );
};

export const useAdminMCPServers = (config?: UseQueryOptions<AdminMCPServer[]>) => {
  return useQuery<AdminMCPServer[]>(
    [QueryKeys.adminMCPServers],
    () => dataService.getAdminMCPServers(),
    {
      refetchOnWindowFocus: false,
      retry: false,
      ...config,
    },
  );
};

export const useAdminMCPStats = (config?: UseQueryOptions<AdminMCPStats>) => {
  return useQuery<AdminMCPStats>(
    [QueryKeys.adminMCPStats],
    () => dataService.getAdminMCPStats(),
    {
      refetchOnWindowFocus: false,
      retry: false,
      ...config,
    },
  );
};

export const useAdminTokenStats = (config?: UseQueryOptions<AdminTokenStats>) => {
  return useQuery<AdminTokenStats>(
    [QueryKeys.adminTokenStats],
    () => dataService.getAdminTokenStats(),
    {
      refetchOnWindowFocus: false,
      retry: false,
      ...config,
    },
  );
};

export const useAdminModels = (config?: UseQueryOptions<AdminModelsConfig>) => {
  return useQuery<AdminModelsConfig>(
    [QueryKeys.adminModels],
    () => dataService.getAdminModels(),
    {
      refetchOnWindowFocus: false,
      retry: false,
      ...config,
    },
  );
};
