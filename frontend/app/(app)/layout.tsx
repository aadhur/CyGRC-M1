'use client';

import AppSidebar from '@/components/AppSidebar';
import AppTopBar from '@/components/AppTopBar';
import { useAuth } from '@/lib/auth/context';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Authenticated App Layout
 * Wraps all authenticated pages with sidebar and top bar
 * Redirects to login if not authenticated
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-slate-950 to-slate-900">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-slate-700 border-t-orange-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Redirect in progress
  }

  return (
    <div className="flex min-h-screen bg-gradient-to-b from-slate-950 to-slate-900">
      {/* Sidebar */}
      <AppSidebar />

      {/* Main content */}
      <div className="ml-64 w-full flex flex-col">
        {/* Top bar */}
        <AppTopBar />

        {/* Page content */}
        <main className="mt-16 flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
