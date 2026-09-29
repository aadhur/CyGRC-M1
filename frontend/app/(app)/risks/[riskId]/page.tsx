"use client";

import React, { use } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, RefreshCw, ShieldAlert } from "lucide-react";

import { useAuth } from "@/lib/auth/context";
import { apiFetch } from "@/lib/api/client";
import { ForbiddenState } from "@/components/ForbiddenState";
import { RiskDetail, type Risk } from "@/components/risks/RiskDetail";

interface RiskPageProps {
  params: Promise<{ riskId: string }>;
}

function RiskDetailSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Back link skeleton */}
      <div className="h-4 w-36 bg-zinc-800/80 rounded" />

      {/* Top Metadata Bar Skeleton */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-6 space-y-4">
        <div className="h-4 w-64 bg-zinc-800/70 rounded" />
        <div className="h-8 w-96 bg-zinc-800 rounded" />
        <div className="flex gap-2 pt-1">
          <div className="h-6 w-28 bg-zinc-800 rounded-full" />
          <div className="h-6 w-20 bg-zinc-800 rounded-full" />
          <div className="h-6 w-32 bg-zinc-800 rounded-full" />
        </div>
      </div>

      {/* Grid Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-5 space-y-3">
            <div className="h-5 w-48 bg-zinc-800 rounded" />
            <div className="h-16 w-full bg-zinc-800/60 rounded" />
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-5 space-y-3">
            <div className="h-5 w-48 bg-zinc-800 rounded" />
            <div className="h-12 w-full bg-zinc-800/60 rounded" />
          </div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-5 space-y-4">
          <div className="h-5 w-40 bg-zinc-800 rounded" />
          <div className="h-24 w-full bg-zinc-800/60 rounded" />
          <div className="h-10 w-full bg-zinc-800/40 rounded" />
        </div>
      </div>

      {/* Treatment Panel Skeleton */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-6 space-y-4">
        <div className="h-6 w-60 bg-zinc-800 rounded" />
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="h-10 bg-zinc-800/70 rounded" />
          <div className="h-10 bg-zinc-800/70 rounded" />
          <div className="h-10 bg-zinc-800/70 rounded" />
          <div className="h-10 bg-zinc-800/70 rounded" />
        </div>
        <div className="h-28 w-full bg-zinc-800/50 rounded" />
      </div>
    </div>
  );
}

export default function RiskDetailPage({ params }: RiskPageProps) {
  const { riskId } = use(params);
  const { can, isLoading: authLoading } = useAuth();

  // Scope check for risks:read
  const hasReadPermission = can(["risks:read"]);

  const {
    data: risk,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery<Risk>({
    queryKey: ["risk", riskId],
    queryFn: async () => {
      return apiFetch<Risk>(`/v1/risks/${riskId}`);
    },
    enabled: hasReadPermission && Boolean(riskId),
    retry: 1,
  });

  // Non-redirecting 403 Forbidden State
  if (!authLoading && !hasReadPermission) {
    return (
      <ForbiddenState message="You do not possess permission to view the Risk Register." />
    );
  }

  // Loading Skeleton State
  if (authLoading || isLoading) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <RiskDetailSkeleton />
      </div>
    );
  }

  // Error State with Retry button
  if (isError) {
    const errorMsg =
      error instanceof Error &&
      !/(?:select|insert|update|delete|psycopg|asyncpg|syntax)/i.test(
        error.message,
      )
        ? error.message
        : "Failed to load risk details. Please verify your connection or try again.";

    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <Link
          href="/risks"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Risk Register
        </Link>

        <div className="rounded-xl border border-rose-800/60 bg-rose-950/30 p-8 text-center max-w-xl mx-auto shadow-lg">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-rose-950/70 border border-rose-800/80 text-rose-400">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h2 className="mt-4 text-lg font-bold text-zinc-100">
            Error Loading Risk
          </h2>
          <p className="mt-2 text-sm text-zinc-400 leading-relaxed">
            {errorMsg}
          </p>
          <button
            type="button"
            disabled={isFetching}
            onClick={() => refetch()}
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 px-4 py-2 text-sm font-medium text-zinc-100 transition cursor-pointer disabled:opacity-50"
          >
            <RefreshCw
              className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
            />
            {isFetching ? "Retrying..." : "Retry Connection"}
          </button>
        </div>
      </div>
    );
  }

  // Empty / Not Found State
  if (!risk) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <Link
          href="/risks"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Risk Register
        </Link>

        <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-12 text-center max-w-lg mx-auto">
          <ShieldAlert className="mx-auto h-12 w-12 text-zinc-500" />
          <h2 className="mt-4 text-lg font-semibold text-zinc-200">
            Risk Not Found
          </h2>
          <p className="mt-2 text-sm text-zinc-400">
            The requested risk could not be found or you may not have access to
            view it.
          </p>
          <div className="mt-6">
            <Link
              href="/risks"
              className="inline-flex items-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 transition"
            >
              Return to Risk Register
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <RiskDetail risk={risk} onRefresh={() => refetch()} />
    </div>
  );
}
