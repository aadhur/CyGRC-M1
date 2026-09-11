'use client';

import { LogOutIcon, User } from 'lucide-react';
import { useAuth } from '@/lib/auth/context';
import { getRoleLabel } from '@/lib/auth/permissions';

/**
 * AppTopBar Component
 * Fixed top navigation bar for authenticated pages
 * Displays user info and logout button
 */
export default function AppTopBar() {
  const { user, logout } = useAuth();

  if (!user) return null;

  const primaryRole = user.roles?.[0] || 'user';
  const roleLabel = getRoleLabel(primaryRole as any);

  return (
    <header className="fixed top-0 left-64 right-0 h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-6 z-40">
      {/* Left side - Empty for now, can be used for breadcrumbs */}
      <div className="flex-1" />

      {/* Right side - User info and logout */}
      <div className="flex items-center gap-4">
        {/* User info */}
        <div className="flex items-center gap-3 pr-4 border-r border-slate-700">
          <div className="flex flex-col items-end">
            <span className="text-sm font-medium text-white">
              {user.name || user.preferred_username || user.email}
            </span>
            <span className="text-xs text-slate-400">{roleLabel}</span>
          </div>
          <div className="w-8 h-8 rounded-full bg-orange-600 flex items-center justify-center flex-shrink-0">
            <User className="w-4 h-4 text-white" />
          </div>
        </div>

        {/* Logout button */}
        <button
          onClick={logout}
          className="flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          title="Logout"
        >
          <LogOutIcon className="w-4 h-4" />
          <span>Logout</span>
        </button>
      </div>
    </header>
  );
}
