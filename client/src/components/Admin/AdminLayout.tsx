import React, { useState, useCallback } from 'react';
import { Outlet, NavLink, Navigate, useLocation } from 'react-router-dom';
import { SystemRoles } from 'librechat-data-provider';
import {
  LayoutDashboard,
  Users,
  MessageSquare,
  Shield,
  Megaphone,
  Settings,
  FolderOpen,
  MonitorSmartphone,
  ScrollText,
  Plug,
  ArrowLeft,
  Server,
  Coins,
  Cpu,
  Menu,
  X,
} from 'lucide-react';
import { useAuthContext } from '~/hooks/AuthContext';
import { useLocalize } from '~/hooks';

const navItems = [
  { to: '/admin', icon: LayoutDashboard, labelKey: 'com_admin_dashboard' as const, end: true },
  { to: '/admin/users', icon: Users, labelKey: 'com_admin_users' as const, end: false },
  { to: '/admin/conversations', icon: MessageSquare, labelKey: 'com_admin_conversations' as const, end: false },
  { to: '/admin/roles', icon: Shield, labelKey: 'com_admin_roles' as const, end: false },
  { to: '/admin/models', icon: Cpu, labelKey: 'com_admin_models' as const, end: false },
  { to: '/admin/files', icon: FolderOpen, labelKey: 'com_admin_files' as const, end: false },
  { to: '/admin/sessions', icon: MonitorSmartphone, labelKey: 'com_admin_sessions' as const, end: false },
  { to: '/admin/banners', icon: Megaphone, labelKey: 'com_admin_banners' as const, end: false },
  { to: '/admin/logs', icon: ScrollText, labelKey: 'com_admin_logs' as const, end: false },
  { to: '/admin/endpoints', icon: Plug, labelKey: 'com_admin_endpoints' as const, end: false },
  { to: '/admin/mcp', icon: Server, labelKey: 'com_admin_mcp_servers' as const, end: false },
  { to: '/admin/tokens', icon: Coins, labelKey: 'com_admin_token_usage' as const, end: false },
  { to: '/admin/settings', icon: Settings, labelKey: 'com_admin_settings' as const, end: false },
];

export default function AdminLayout() {
  const { user, isAuthenticated } = useAuthContext();
  const localize = useLocalize();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  React.useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  if (!isAuthenticated) {
    return null;
  }

  if (!user || user.role !== SystemRoles.ADMIN) {
    return <Navigate to="/" replace />;
  }

  const sidebarContent = (
    <>
      <div className="flex items-center justify-between border-b border-border-light p-4">
        <NavLink
          to="/c/new"
          className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary"
        >
          <ArrowLeft className="size-4" />
          {localize('com_admin_back_to_chat')}
        </NavLink>
        <button
          onClick={closeSidebar}
          className="rounded p-1 text-text-secondary hover:bg-surface-hover hover:text-text-primary md:hidden"
          aria-label="Close sidebar"
        >
          <X className="size-5" />
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto p-2">
        {navItems.map(({ to, icon: Icon, labelKey, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `mb-1 flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                isActive
                  ? 'bg-surface-hover text-text-primary font-medium'
                  : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
              }`
            }
          >
            <Icon className="size-4" />
            {localize(labelKey)}
          </NavLink>
        ))}
      </nav>
    </>
  );

  return (
    <div className="flex h-screen bg-surface-primary">
      {/* Mobile hamburger */}
      <button
        onClick={() => setSidebarOpen(true)}
        className="fixed left-4 top-4 z-40 flex size-10 items-center justify-center rounded-lg border border-border-light bg-surface-secondary shadow-sm md:hidden"
        aria-label="Open sidebar"
      >
        <Menu className="size-5 text-text-primary" />
      </button>

      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={closeSidebar}
          role="presentation"
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-60 flex-col border-r border-border-light bg-surface-secondary transition-transform duration-200 md:hidden ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden w-60 flex-col border-r border-border-light bg-surface-secondary md:flex">
        {sidebarContent}
      </aside>

      <main className="flex-1 overflow-y-auto pt-16 md:pt-0">
        <Outlet />
      </main>
    </div>
  );
}
