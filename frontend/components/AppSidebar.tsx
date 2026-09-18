'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LockIcon, BarChart3, Book, Clock, Users, Zap, AlertCircle, Shield, FileText } from 'lucide-react';
import { useAuth } from '@/lib/auth/context';
import type { Scope } from "@/lib/auth/permissions";
import { cn } from '@/lib/utils';

interface SidebarItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  requiredScopes?: Scope[];
  locked?: boolean;
  group?: string;
}

/**
 * AppSidebar Component
 * Fixed left sidebar with navigation items
 * Shows/hides items based on user scopes
 * Locked items route to ComingSoon page
 */
export default function AppSidebar() {
  const pathname = usePathname();
  const { can } = useAuth();

  const SIDEBAR_ITEMS: SidebarItem[] = [
    {
      label: 'Dashboard',
      href: '/dashboard',
      icon: <BarChart3 className="w-5 h-5" />,
      group: 'main',
    },
    {
      label: 'Controls',
      href: '/controls',
      icon: <Shield className="w-5 h-5" />,
      requiredScopes: ['controls:read'],
      group: 'compliance',
    },
    {
      label: 'Frameworks',
      href: '/frameworks',
      icon: <Book className="w-5 h-5" />,
      requiredScopes: ['frameworks:read'],
      group: 'compliance',
    },
    {
      label: 'Audit Log',
      href: '/audit-log',
      icon: <Clock className="w-5 h-5" />,
      requiredScopes: ['auditlog:read'],
      group: 'compliance',
    },
    {
      label: 'Team',
      href: '/settings/team',
      icon: <Users className="w-5 h-5" />,
      requiredScopes: ['users:read'],
      group: 'settings',
    },
    {
      label: 'Platform Operator',
      href: '/operator',
      icon: <Zap className="w-5 h-5" />,
      requiredScopes: ['operator:admin'],
      group: 'settings',
    },
    {
      label: 'Risk Register',
      href: '/risks',
      icon: <AlertCircle className="w-5 h-5" />,
      requiredScopes: ['risks:read'],
      locked: true,
      group: 'locked',
    },
    {
      label: 'Audit Cycles',
      href: '/audits',
      icon: <FileText className="w-5 h-5" />,
      requiredScopes: ['audits:read'],
      locked: true,
      group: 'locked',
    },
    {
      label: 'DPDP Compliance Center',
      href: '/dpdp',
      icon: <Shield className="w-5 h-5" />,
      requiredScopes: ['dpdp:read'],
      locked: true,
      group: 'locked',
    },
  ];

  const isItemVisible = (item: SidebarItem): boolean => {
    if (!item.requiredScopes) return true;
    return can(item.requiredScopes);
  };

  const isItemActive = (item: SidebarItem): boolean => {
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  };

  const getItemHref = (item: SidebarItem): string => {
    if (item.locked) {
      return `/coming-soon?feature=${encodeURIComponent(item.label)}&locked=true`;
    }
    return item.href;
  };

  const visibleItems = SIDEBAR_ITEMS.filter(isItemVisible);

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-slate-900 border-r border-slate-800 overflow-y-auto pt-20 z-40">
      <nav className="flex flex-col space-y-1 px-3 py-4">
        {visibleItems.map((item) => {
          const isActive = isItemActive(item);
          const isLocked = item.locked;

          return (
            <Link
              key={item.href}
              href={getItemHref(item)}
              className={cn(
                'flex items-center gap-3 px-4 py-2 rounded-lg font-medium text-sm transition-colors',
                isActive && !isLocked
                  ? 'bg-orange-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white',
                isLocked && 'opacity-60 cursor-default hover:bg-slate-800'
              )}
            >
              <span className="flex-shrink-0">{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              {isLocked && <LockIcon className="w-4 h-4 flex-shrink-0" />}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
