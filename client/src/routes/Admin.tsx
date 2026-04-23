import {
  AdminLayout,
  AdminDashboard,
  AdminUserList,
  AdminUserDetail,
  AdminRolePermissions,
  AdminBannerManagement,
  AdminSystemSettings,
  AdminConversations,
  AdminFiles,
  AdminSessions,
  AdminLogs,
  AdminEndpoints,
  AdminMCP,
  AdminTokens,
  AdminModels,
} from '~/components/Admin';

const adminRoutes = {
  path: 'admin/*',
  element: <AdminLayout />,
  children: [
    {
      index: true,
      element: <AdminDashboard />,
    },
    {
      path: 'users',
      element: <AdminUserList />,
    },
    {
      path: 'users/:userId',
      element: <AdminUserDetail />,
    },
    {
      path: 'roles',
      element: <AdminRolePermissions />,
    },
    {
      path: 'models',
      element: <AdminModels />,
    },
    {
      path: 'conversations',
      element: <AdminConversations />,
    },
    {
      path: 'files',
      element: <AdminFiles />,
    },
    {
      path: 'sessions',
      element: <AdminSessions />,
    },
    {
      path: 'banners',
      element: <AdminBannerManagement />,
    },
    {
      path: 'logs',
      element: <AdminLogs />,
    },
    {
      path: 'endpoints',
      element: <AdminEndpoints />,
    },
    {
      path: 'mcp',
      element: <AdminMCP />,
    },
    {
      path: 'tokens',
      element: <AdminTokens />,
    },
    {
      path: 'settings',
      element: <AdminSystemSettings />,
    },
  ],
};

export default adminRoutes;
