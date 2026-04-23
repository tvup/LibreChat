export interface AdminUserItem {
  _id: string;
  name?: string;
  username?: string;
  email: string;
  role?: string;
  provider: string;
  avatar?: string;
  emailVerified: boolean;
  twoFactorEnabled?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface AdminUserDetail extends AdminUserItem {
  balance?: number;
  googleId?: string;
  openidId?: string;
  githubId?: string;
  discordId?: string;
  appleId?: string;
  facebookId?: string;
  samlId?: string;
  ldapId?: string;
  plugins?: string[];
  favorites?: Array<{ agentId?: string; model?: string; endpoint?: string }>;
  termsAccepted?: boolean;
  personalization?: { memories?: boolean };
}

export interface AdminUserListParams {
  limit?: number;
  cursor?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
  role?: string;
  provider?: string;
}

export interface AdminUserListResponse {
  data: AdminUserItem[];
  pagination: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    nextCursor?: string;
    previousCursor?: string;
    totalCount?: number;
  };
}

export interface AdminUpdateUserRequest {
  name?: string;
  email?: string;
  role?: string;
  emailVerified?: boolean;
}

export interface AdminResetPasswordRequest {
  newPassword: string;
}

export interface AdminBanUserRequest {
  duration: number;
}

export interface AdminSetBalanceRequest {
  amount: number;
  mode: 'add' | 'set';
}

export interface AdminCreateUserRequest {
  name?: string;
  email: string;
  password: string;
  role?: string;
}

export interface AdminDashboardRecentUser {
  _id: string;
  name?: string;
  email: string;
  createdAt: string;
  lastActive?: string;
  messageCount?: number;
}

export interface AdminDashboardProviderStat {
  provider: string;
  count: number;
}

export interface AdminDashboardStats {
  totalUsers: number;
  newUsersLast7Days: number;
  newUsersLast30Days: number;
  totalConversations: number;
  activeConversationsLast7Days: number;
  totalBannedUsers: number;
  recentRegistrations: AdminDashboardRecentUser[];
  topProviders: AdminDashboardProviderStat[];
}

export interface AdminConversationItem {
  conversationId: string;
  title: string;
  user: {
    _id: string;
    name?: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
  endpoint?: string;
  model?: string;
}

export interface AdminConversationListResponse {
  data: AdminConversationItem[];
  pagination: {
    hasNextPage: boolean;
    nextCursor?: string;
    totalCount?: number;
  };
}

export interface AdminConversationStats {
  totalConversations: number;
  conversationsToday: number;
  conversationsThisWeek: number;
}

export interface AdminBannerItem {
  _id: string;
  bannerId: string;
  message: string;
  displayFrom: string;
  displayTo?: string;
  type: 'banner' | 'popup';
  isPublic: boolean;
  persistable: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface AdminCreateBannerRequest {
  bannerId: string;
  message: string;
  displayFrom: string;
  displayTo?: string;
  type: 'banner' | 'popup';
  isPublic: boolean;
  persistable: boolean;
}

export type AdminUpdateBannerRequest = Partial<AdminCreateBannerRequest>;

export interface AdminSocialMapping {
  _id: string;
  socialEmail: string;
  provider: string;
  targetUserId: string;
  targetUser?: { _id: string; name?: string; email: string };
  createdAt?: string;
}

export interface AdminCreateSocialMappingRequest {
  socialEmail: string;
  provider: string;
  targetUserId: string;
}

export interface AdminFileItem {
  _id: string;
  file_id: string;
  filename: string;
  filepath: string;
  source: string;
  type: string;
  size: number;
  usage?: number;
  user: { _id: string; name?: string; email: string };
  createdAt: string;
}

export interface AdminFileListResponse {
  data: AdminFileItem[];
  pagination: {
    hasNextPage: boolean;
    nextCursor?: string;
    totalCount?: number;
  };
}

export interface AdminFileStats {
  totalFiles: number;
  totalSize: number;
  filesByType: Array<{ type: string; count: number; totalSize: number }>;
}

export interface AdminActiveSession {
  _id: string;
  name?: string;
  email: string;
  sessionCount: number;
  lastActive?: string;
}

export interface AdminViolationSummary {
  type: string;
  count: number;
}

export interface AdminSystemInfo {
  uptime: number;
  nodeVersion: string;
  memoryUsage: { rss: number; heapTotal: number; heapUsed: number };
  platform: string;
}

export interface AdminEndpointStats {
  endpointCounts: Array<{ endpoint: string; count: number }>;
  modelUsage: Array<{ endpoint: string; model: string; count: number }>;
}

export interface AdminMCPServer {
  _id: string;
  name: string;
  url?: string;
  type?: string;
  tools?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface AdminMCPStats {
  totalServers: number;
  serversByType: Array<{ type: string; count: number }>;
}

export interface AdminDailyTokenUsage {
  date: string;
  tokens: number;
}

export interface AdminUserTokenUsage {
  userId: string;
  name?: string;
  email?: string;
  totalTokens: number;
}

export interface AdminModelTokenUsage {
  model: string;
  totalTokens: number;
}

export interface AdminTokenStats {
  totalTokens: number;
  dailyUsage: AdminDailyTokenUsage[];
  topUsers: AdminUserTokenUsage[];
  usageByModel: AdminModelTokenUsage[];
}

export interface AdminModelItem {
  model: string;
  enabled: boolean;
}

export type AdminModelsConfig = Record<string, AdminModelItem[]>;

export interface AdminToggleModelRequest {
  endpoint: string;
  model: string;
  disabled: boolean;
}

export interface AdminToggleModelResponse {
  endpoint: string;
  disabledModels: string[];
}

export interface AdminBulkModelRequest {
  endpoint: string;
  disabledModels: string[];
}

export interface AdminBulkActionRequest {
  userIds: string[];
}

export interface AdminBulkBanRequest extends AdminBulkActionRequest {
  duration: number;
}

export interface AdminBulkRoleRequest extends AdminBulkActionRequest {
  role: string;
}

export interface AdminInviteUserRequest {
  email: string;
  role?: string;
}

export interface AdminInviteUserResponse {
  message: string;
  tempPassword: string;
  user: AdminUserItem;
}
