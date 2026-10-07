"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/context";
import { AppSidebar } from "@/components/AppSidebar";
import { AppTopBar } from "@/components/AppTopbar";
import { BreakGlassBanner } from "@/components/BreakGlassBanner";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoading, token } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    // Only redirect if mounted, NOT loading, and definitely no token exists
    if (mounted && !isLoading && !isAuthenticated && !token) {
      router.replace("/login");
    }
  }, [mounted, isLoading, isAuthenticated, token, router]);

  // Keep showing the loader while auth initializes from cookies
  if (!mounted || isLoading || (!isAuthenticated && token)) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-xs font-mono text-slate-400">Loading CyGRC Workspace...</p>
      </main>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="flex min-h-screen bg-background text-slate-100">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <BreakGlassBanner />
        <AppTopBar />
        <main className="flex-1 p-8 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}