"use client";

import { useState } from "react";
import { ClipboardCheck, Plus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { api, ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/context";
import { SCOPES } from "@/lib/auth/permissions";
import { ForbiddenState } from "@/components/ForbiddenState";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { QueryError } from "@/components/QueryError";
import { EmptyState } from "@/components/EmptyState";
import NewAuditModal from "@/components/audits/NewAuditModal";
import AuditTable, { type Audit } from "@/components/audits/AuditTable";

function getErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unable to load audit cycles.";
}

export default function AuditsPage() {
  const { can } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);

  const canRead = can([SCOPES.AUDITS_READ]);
  const canWrite = can([SCOPES.AUDITS_WRITE]);

  const auditsQuery = useQuery({
    queryKey: ["audits"],
    queryFn: () => api.get<Audit[]>("/v1/audits"),
    enabled: canRead,
  });

  const audits = auditsQuery.data ?? [];

  if (
    !canRead ||
    (auditsQuery.error instanceof ApiError &&
      auditsQuery.error.status === 403)
  ) {
    return <ForbiddenState />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs font-semibold uppercase tracking-wider text-brand-orange">
            AUDIT MANAGEMENT
          </p>

          <h1 className="mt-1 text-2xl font-heading font-bold text-slate-100">
            Audit Cycles
          </h1>

          <p className="mt-1 text-sm text-slate-400">
            Plan scoped audits, define assessment periods, and track audit
            progress.
          </p>
        </div>

        {canWrite && (
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-orange px-4 py-2.5 text-sm font-semibold text-black transition hover:brightness-110"
          >
            <Plus className="h-4 w-4" />
            Start Audit
          </button>
        )}
      </div>

      <section className="rounded-2xl border border-border bg-surface">
        {auditsQuery.isLoading ? (
          <div className="p-6">
            <LoadingSkeleton rows={5} />
          </div>
        ) : auditsQuery.isError ? (
          <QueryError
            message={getErrorMessage(auditsQuery.error)}
            onRetry={() => auditsQuery.refetch()}
            isRetrying={auditsQuery.isFetching}
          />
        ) : audits.length === 0 ? (
          <EmptyState
            icon={<ClipboardCheck className="h-6 w-6" />}
            title="No audits found"
            description={
              canWrite
                ? "Start your first audit cycle to begin tracking an assessment."
                : "No audit cycles have been created for this tenant."
            }
          />
        ) : (
          <AuditTable audits={audits} />
        )}
      </section>

      {canWrite && (
        <NewAuditModal
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          onSuccess={() => auditsQuery.refetch()}
        />
      )}
    </div>
  );
}