'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Bot, Container, ScrollText, Terminal, Settings,
  LayoutDashboard, Zap, LogOut, ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Overview', exact: true },
  { href: '/dashboard/agents', icon: Bot, label: 'Agents' },
  { href: '/dashboard/docker', icon: Container, label: 'Docker' },
  { href: '/dashboard/audit', icon: ScrollText, label: 'Audit Log' },
  { href: '/dashboard/terminal', icon: Terminal, label: 'Terminal' },
  { href: '/dashboard/settings', icon: Settings, label: 'Settings' },
];

interface SidebarProps {
  userEmail: string;
  userRole: string;
}

export function Sidebar({ userEmail, userRole }: SidebarProps): React.JSX.Element {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async (): Promise<void> => {
    try {
      await api.post('/auth/logout');
    } catch { /* ignore */ }
    router.push('/auth/login');
    router.refresh();
  };

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-64 bg-card border-r flex flex-col z-10">
      {/* Logo */}
      <div className="p-4 border-b">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🥜</span>
          <div>
            <div className="font-bold text-sm">PeanutAgent</div>
            <div className="text-xs text-muted-foreground">Enterprise</div>
          </div>
        </div>
      </div>

      {/* Kilo Code status indicator */}
      <div className="px-4 py-2 border-b">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Zap className="h-3 w-3 text-peanut-400" />
          <span>Kilo Code Bridge</span>
          <span className="ml-auto w-2 h-2 rounded-full bg-green-500" />
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const isActive = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors group',
                isActive
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted',
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span className="flex-1">{item.label}</span>
              {isActive && <ChevronRight className="h-3 w-3" />}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="p-4 border-t">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-medium text-sm">
            {userEmail[0]?.toUpperCase() ?? 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{userEmail}</div>
            <div className="text-xs text-muted-foreground capitalize">{userRole}</div>
          </div>
        </div>
        <button
          onClick={() => void handleLogout()}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
        >
          <LogOut className="h-3 w-3" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
