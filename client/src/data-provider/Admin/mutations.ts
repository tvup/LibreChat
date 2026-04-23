import { useMutation, useQueryClient } from '@tanstack/react-query';
import { QueryKeys, MutationKeys, dataService } from 'librechat-data-provider';

import type {
  AdminUserItem,
  AdminUpdateUserRequest,
  AdminResetPasswordRequest,
  AdminBanUserRequest,
  AdminSetBalanceRequest,
  AdminCreateUserRequest,
  AdminCreateBannerRequest,
  AdminUpdateBannerRequest,
  AdminBannerItem,
  AdminBulkBanRequest,
  AdminBulkActionRequest,
  AdminBulkRoleRequest,
  AdminInviteUserRequest,
  AdminInviteUserResponse,
  AdminToggleModelRequest,
  AdminToggleModelResponse,
  AdminBulkModelRequest,
} from 'librechat-data-provider';

export const useAdminCreateUser = () => {
  const queryClient = useQueryClient();
  return useMutation(
    [MutationKeys.adminCreateUser],
    (data: AdminCreateUserRequest) => dataService.createAdminUser(data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries([QueryKeys.adminUsers]);
        queryClient.invalidateQueries([QueryKeys.adminDashboard]);
      },
    },
  );
};

export const useAdminUpdateUser = () => {
  const queryClient = useQueryClient();
  return useMutation(
    [MutationKeys.adminUpdateUser],
    ({ userId, data }: { userId: string; data: AdminUpdateUserRequest }) =>
      dataService.updateAdminUser(userId, data),
    {
      onSuccess: (_data: AdminUserItem, variables) => {
        queryClient.invalidateQueries([QueryKeys.adminUsers]);
        queryClient.invalidateQueries([QueryKeys.adminUserDetail, variables.userId]);
      },
    },
  );
};

export const useAdminDeleteUser = () => {
  const queryClient = useQueryClient();
  return useMutation(
    [MutationKeys.adminDeleteUser],
    (userId: string) => dataService.deleteAdminUser(userId),
    {
      onSuccess: () => {
        queryClient.invalidateQueries([QueryKeys.adminUsers]);
        queryClient.invalidateQueries([QueryKeys.adminDashboard]);
      },
    },
  );
};

export const useAdminBanUser = () => {
  const queryClient = useQueryClient();
  return useMutation(
    [MutationKeys.adminBanUser],
    ({ userId, data }: { userId: string; data: AdminBanUserRequest }) =>
      dataService.banAdminUser(userId, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries([QueryKeys.adminUsers]);
      },
    },
  );
};

export const useAdminUnbanUser = () => {
  const queryClient = useQueryClient();
  return useMutation(
    [MutationKeys.adminUnbanUser],
    (userId: string) => dataService.unbanAdminUser(userId),
    {
      onSuccess: () => {
        queryClient.invalidateQueries([QueryKeys.adminUsers]);
      },
    },
  );
};

export const useAdminResetPassword = () => {
  return useMutation(
    [MutationKeys.adminResetPassword],
    ({ userId, data }: { userId: string; data: AdminResetPasswordRequest }) =>
      dataService.resetAdminUserPassword(userId, data),
  );
};

export const useAdminSetBalance = () => {
  const queryClient = useQueryClient();
  return useMutation(
    [MutationKeys.adminSetBalance],
    ({ userId, data }: { userId: string; data: AdminSetBalanceRequest }) =>
      dataService.setAdminUserBalance(userId, data),
    {
      onSuccess: (_data, variables) => {
        queryClient.invalidateQueries([QueryKeys.adminUserDetail, variables.userId]);
      },
    },
  );
};

export const useAdminCreateBanner = () => {
  const queryClient = useQueryClient();
  return useMutation(
    [MutationKeys.adminCreateBanner],
    (data: AdminCreateBannerRequest) => dataService.createAdminBanner(data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries([QueryKeys.adminBanners]);
      },
    },
  );
};

export const useAdminUpdateBanner = () => {
  const queryClient = useQueryClient();
  return useMutation(
    [MutationKeys.adminUpdateBanner],
    ({ bannerId, data }: { bannerId: string; data: AdminUpdateBannerRequest }) =>
      dataService.updateAdminBanner(bannerId, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries([QueryKeys.adminBanners]);
      },
    },
  );
};

export const useAdminDeleteBanner = () => {
  const queryClient = useQueryClient();
  return useMutation(
    [MutationKeys.adminDeleteBanner],
    (bannerId: string) => dataService.deleteAdminBanner(bannerId),
    {
      onSuccess: () => {
        queryClient.invalidateQueries([QueryKeys.adminBanners]);
        queryClient.invalidateQueries([QueryKeys.banner]);
      },
    },
  );
};

export const useAdminDeleteConversation = () => {
  const queryClient = useQueryClient();
  return useMutation(
    [MutationKeys.adminDeleteConversation],
    (conversationId: string) => dataService.deleteAdminConversation(conversationId),
    {
      onSuccess: () => {
        queryClient.invalidateQueries([QueryKeys.adminConversations]);
        queryClient.invalidateQueries([QueryKeys.adminConversationStats]);
        queryClient.invalidateQueries([QueryKeys.adminDashboard]);
      },
    },
  );
};

export const useAdminDeleteFile = () => {
  const queryClient = useQueryClient();
  return useMutation(
    [MutationKeys.adminDeleteFile],
    (fileId: string) => dataService.deleteAdminFile(fileId),
    {
      onSuccess: () => {
        queryClient.invalidateQueries([QueryKeys.adminFiles]);
        queryClient.invalidateQueries([QueryKeys.adminFileStats]);
      },
    },
  );
};

export const useAdminRevokeSessions = () => {
  const queryClient = useQueryClient();
  return useMutation(
    [MutationKeys.adminRevokeSessions],
    (userId: string) => dataService.revokeAdminUserSessions(userId),
    {
      onSuccess: () => {
        queryClient.invalidateQueries([QueryKeys.adminSessions]);
      },
    },
  );
};

export const useAdminReinitializeMCP = () => {
  const queryClient = useQueryClient();
  return useMutation(
    [MutationKeys.adminReinitializeMCP],
    (serverName: string) => dataService.reinitializeAdminMCPServer(serverName),
    {
      onSuccess: () => {
        queryClient.invalidateQueries([QueryKeys.adminMCPServers]);
      },
    },
  );
};

export const useAdminBulkBan = () => {
  const queryClient = useQueryClient();
  return useMutation(
    [MutationKeys.adminBulkBan],
    (data: AdminBulkBanRequest) => dataService.bulkBanAdminUsers(data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries([QueryKeys.adminUsers]);
      },
    },
  );
};

export const useAdminBulkDelete = () => {
  const queryClient = useQueryClient();
  return useMutation(
    [MutationKeys.adminBulkDelete],
    (data: AdminBulkActionRequest) => dataService.bulkDeleteAdminUsers(data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries([QueryKeys.adminUsers]);
        queryClient.invalidateQueries([QueryKeys.adminDashboard]);
      },
    },
  );
};

export const useAdminBulkRole = () => {
  const queryClient = useQueryClient();
  return useMutation(
    [MutationKeys.adminBulkRole],
    (data: AdminBulkRoleRequest) => dataService.bulkRoleAdminUsers(data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries([QueryKeys.adminUsers]);
      },
    },
  );
};

export const useAdminInviteUser = () => {
  const queryClient = useQueryClient();
  return useMutation<AdminInviteUserResponse, unknown, AdminInviteUserRequest>(
    [MutationKeys.adminInviteUser],
    (data: AdminInviteUserRequest) => dataService.inviteAdminUser(data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries([QueryKeys.adminUsers]);
        queryClient.invalidateQueries([QueryKeys.adminDashboard]);
      },
    },
  );
};

export const useAdminToggleModel = () => {
  const queryClient = useQueryClient();
  return useMutation<AdminToggleModelResponse, unknown, AdminToggleModelRequest>(
    [MutationKeys.adminToggleModel],
    (data: AdminToggleModelRequest) => dataService.toggleAdminModel(data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries([QueryKeys.adminModels]);
        queryClient.invalidateQueries([QueryKeys.models]);
      },
    },
  );
};

export const useAdminBulkModels = () => {
  const queryClient = useQueryClient();
  return useMutation<AdminToggleModelResponse, unknown, AdminBulkModelRequest>(
    [MutationKeys.adminBulkModels],
    (data: AdminBulkModelRequest) => dataService.bulkAdminModels(data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries([QueryKeys.adminModels]);
        queryClient.invalidateQueries([QueryKeys.models]);
      },
    },
  );
};
