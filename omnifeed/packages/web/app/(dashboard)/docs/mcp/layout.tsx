'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Cpu, BookOpen, Wrench, Key, HelpCircle, Download } from 'lucide-react';
import type { ReactNode } from 'react';

type NavLink = { href: string; label: string; icon?: typeof BookOpen };

const PRIMARY: NavLink[] = [
  { href: '/docs/mcp', label: 'Quickstart', icon: BookOpen },
  { href: '/docs/mcp/tools', label: 'Tools reference', icon: Wrench },
  { href: '/docs/mcp/authentication', label: 'Authentication', icon: Key },
  { href: '/docs/mcp/troubleshooting', label: 'Troubleshooting', icon: HelpCircle },
];

const INSTALL: NavLink[] = [
  { href: '/docs/mcp/install/hosted', label: 'Hosted (no install)' },
  { href: '/docs/mcp/install/claude-desktop', label: 'Claude Desktop' },
  { href: '/docs/mcp/install/claude-code', label: 'Claude Code' },
  { href: '/docs/mcp/install/cursor', label: 'Cursor' },
  { href: '/docs/mcp/install/cline', label: 'Cline' },
  { href: '/docs/mcp/install/roo', label: 'Roo' },
  { href: '/docs/mcp/install/windsurf', label: 'Windsurf' },
  { href: '/docs/mcp/install/zed', label: 'Zed' },
  { href: '/docs/mcp/install/codex', label: 'Codex' },
];

export default function MCPDocsLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Cpu size={20} className="text-accent-green" />
        <h1 className="font-display text-xl font-bold text-text">MCP Server</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6">
        <aside className="space-y-5">
          <nav className="space-y-1">
            {PRIMARY.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2 px-2 py-1.5 text-xs font-display border ${
                  isActive(href)
                    ? 'bg-accent-green text-bg border-accent-green font-semibold'
                    : 'text-text-2 border-transparent hover:text-accent-green'
                }`}
              >
                {Icon && <Icon size={12} />}
                {label}
              </Link>
            ))}
          </nav>

          <div>
            <div className="flex items-center gap-2 px-2 pb-1 text-[10px] uppercase tracking-wider text-text-3 font-display">
              <Download size={10} />
              Install guides
            </div>
            <nav className="space-y-1">
              {INSTALL.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className={`block px-2 py-1.5 text-xs font-display border ${
                    isActive(href)
                      ? 'bg-accent-green text-bg border-accent-green font-semibold'
                      : 'text-text-2 border-transparent hover:text-accent-green'
                  }`}
                >
                  {label}
                </Link>
              ))}
            </nav>
          </div>
        </aside>

        <main className="glass-card p-6 space-y-6 text-sm leading-relaxed">{children}</main>
      </div>
    </div>
  );
}
