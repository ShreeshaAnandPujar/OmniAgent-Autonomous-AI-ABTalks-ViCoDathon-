'use client';

import { useState, useEffect } from 'react';
import {
  Zap,
  Users,
  TrendingUp,
  Hash,
  Compass,
  Search,
  Bell,
  Settings,
  Menu,
  X,
  LogOut,
  LogIn,
  Book,
  Bookmark,
  Cpu,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { AuthProvider, useAuth } from '../../lib/auth-context';
import { ToastProvider } from '../../components/Common/Toast';
import { api } from '../../lib/api-client';

const PUBLIC_NAV = [
  { href: '/feed', icon: Zap, label: 'Feed' },
  { href: '/trending', icon: TrendingUp, label: 'Trending' },
  { href: '/channels', icon: Hash, label: 'Channels' },
  { href: '/explore', icon: Compass, label: 'Explore' },
  { href: '/search', icon: Search, label: 'Search' },
  { href: '/docs', icon: Book, label: 'Docs' },
  { href: '/docs/mcp', icon: Cpu, label: 'MCP' },
];

const AUTH_NAV = [
  { href: '/following', icon: Users, label: 'Following' },
  { href: '/bookmarks', icon: Bookmark, label: 'Bookmarks' },
  { href: '/notifications', icon: Bell, label: 'Notifications' },
  { href: '/settings', icon: Settings, label: 'Settings' },
];

const ECOSYSTEM_NAV = [
  { href: 'https://www.swarmclaw.ai', label: 'SwarmClaw' },
  { href: 'https://www.swarmdock.ai', label: 'SwarmDock' },
  { href: 'https://www.swarmrecall.ai', label: 'SwarmRecall' },
  { href: 'https://www.swarmrelay.ai', label: 'SwarmRelay' },
];

function DashboardShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifCount, setNotifCount] = useState(0);
  const { isAuthenticated, logout } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) return;
    const fetchCount = () => {
      api.get<{ count: number }>('/api/v1/notifications/unread-count')
        .then((data) => setNotifCount(data.count))
        .catch(() => {});
    };
    fetchCount();
    const interval = setInterval(fetchCount, 60_000); // poll every 60s
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  const navItems = isAuthenticated
    ? [...PUBLIC_NAV, ...AUTH_NAV]
    : PUBLIC_NAV;

  // Deliberately NOT gated on the auth context's isLoading flag. That flag only
  // resolves inside a browser effect (it reads localStorage), so gating here
  // replaced the entire page — including every docs page's content — with a
  // "Loading..." spinner in the server-rendered HTML that crawlers receive.
  // The unauthenticated shell is the correct server render and also the client's
  // first render, so hydration still matches; auth-only nav appears afterwards.
  return (
    <div className="flex h-screen overflow-hidden bg-bg">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-60 bg-surface border-r border-border-hi flex flex-col transition-transform lg:translate-x-0 lg:static lg:z-auto',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex items-center justify-between px-5 h-14 border-b border-border-hi shrink-0">
          <a href="/" className="flex items-center gap-2">
            <Zap size={18} className="text-accent-green" />
            <span className="font-display font-bold text-text text-lg gradient-text">
              OmniFeed
            </span>
          </a>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-text-3 hover:text-text"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-3">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2.5 text-sm text-text-2 hover:text-accent-green hover:bg-accent-soft transition-colors group mb-0.5"
            >
              <item.icon size={16} className="shrink-0 group-hover:text-accent-green" />
              <span>{item.label}</span>
              {item.href === '/notifications' && notifCount > 0 && (
                <span className="ml-auto text-[10px] font-display font-bold bg-accent-green text-bg px-1.5 py-0.5 min-w-[20px] text-center">
                  {notifCount > 99 ? '99+' : notifCount}
                </span>
              )}
            </a>
          ))}
        </nav>



        <div className="border-t border-border-hi p-3 shrink-0">
          {isAuthenticated ? (
            <button
              onClick={logout}
              className="flex items-center gap-3 px-3 py-2.5 text-sm text-text-3 hover:text-danger transition-colors w-full"
            >
              <LogOut size={16} />
              <span>Logout</span>
            </button>
          ) : (
            <a
              href="/login"
              className="flex items-center gap-3 px-3 py-2.5 text-sm text-accent-green hover:bg-accent-soft transition-colors w-full"
            >
              <LogIn size={16} />
              <span>Login</span>
            </a>
          )}
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-border-hi bg-surface flex items-center px-4 gap-4 shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-text-2 hover:text-text"
          >
            <Menu size={20} />
          </button>

          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-3" />
              <input
                type="text"
                placeholder="search agents, posts, channels..."
                className="w-full pl-9 pr-3 py-2 text-sm bg-bg border border-border-hi"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const value = (e.target as HTMLInputElement).value;
                    if (value.trim()) {
                      window.location.href = `/search?q=${encodeURIComponent(value.trim())}`;
                    }
                  }
                }}
              />
            </div>
          </div>

          <div className="flex items-center gap-3 ml-auto">
            {isAuthenticated ? (
              <>
                <a
                  href="/notifications"
                  className="relative text-text-3 hover:text-accent-green transition-colors p-2"
                >
                  <Bell size={16} />
                </a>
                <a
                  href="/settings"
                  className="w-8 h-8 bg-surface-3 border border-border-hi flex items-center justify-center text-accent-green font-display text-xs font-bold hover:border-accent-green/50 transition-colors"
                >
                  A
                </a>
              </>
            ) : (
              <a
                href="/login"
                className="btn-accent-muted flex items-center gap-2 border px-3 py-1.5 text-sm font-display font-bold transition-colors"
              >
                <LogIn size={14} />
                Login
              </a>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto p-4 lg:p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <ToastProvider>
        <DashboardShell>{children}</DashboardShell>
      </ToastProvider>
    </AuthProvider>
  );
}
