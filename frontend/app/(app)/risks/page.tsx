"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth/context";
import { api } from "@/lib/api/client";
import { ForbiddenState } from "@/components/ForbiddenState";
import RiskTable from "@/components/risks/RiskTable";
import RiskCreateModal from "@/components/risks/RiskCreateModal";
import { Plus, ShieldAlert, Loader2, AlertCircle, RefreshCw } from "lucide-react";

export default function RiskRegisterPage() {
  const { can } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);

  const canRead = can(["risks:read"]);
  const canWrite = can(["risks:write"]);

  const risksQuery = useQuery({
    queryKey: ["risks"],
    queryFn: () => api.get<any[]>("/v1/risks"),
    enabled: canRead,
  });

  const risks = (risksQuery.data ?? []).map((r) => ({
    ...r,
    id: r.risk_id || r.id,
    linkedControlsCount: r.control_ids ? r.control_ids.length : r.linkedControlsCount || 0,
  }));

  if (!canRead) {
    return <ForbiddenState message="You do not possess permission to view the Risk Register." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-mono font-semibold tracking-wider text-brand-orange uppercase">
            ENTERPRISE RISK GOVERNANCE
          </p>
          <h1 className="text-2xl font-heading font-bold text-slate-100 mt-1">
            Risk Register
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Track inherent risk ratings, mitigation plans, and linked security controls.
          </p>
        </div>

        {canWrite && (
          <button
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-brand-orange hover:bg-brand-orange-hover text-white text-xs font-semibold rounded-xl shadow transition-colors cursor-pointer"
          >
            <Plus size={16} />
            <span>New Risk</span>
          </button>
        )}
      </div>

      <section>
        {risksQuery.isLoading ? (
          <div className="p-16 flex items-center justify-center text-slate-400 gap-2 bg-surface border border-border rounded-2xl">
            <Loader2 size={20} className="animate-spin text-brand-orange" />
            <span>Loading risk register...</span>
          </div>
        ) : risksQuery.isError ? (
          <div className="p-12 text-center bg-surface border border-rose-900/50 rounded-2xl space-y-3">
            <AlertCircle size={28} className="mx-auto text-rose-400" />
            <div className="text-sm font-semibold text-rose-200">
              {risksQuery.error instanceof Error ? risksQuery.error.message : "Unable to load risks."}
            </div>
            <button
              onClick={() => risksQuery.refetch()}
              disabled={risksQuery.isFetching}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface-raised border border-border hover:border-brand-orange text-xs text-slate-300 font-semibold rounded-xl transition cursor-pointer"
            >
              <RefreshCw size={12} className={risksQuery.isFetching ? "animate-spin text-brand-orange" : ""} />
              <span>Retry</span>
            </button>
          </div>
        ) : risks.length === 0 ? (
          <div className="p-16 text-center bg-surface border border-border rounded-2xl space-y-2">
            <ShieldAlert size={28} className="mx-auto text-slate-500" />
            <div className="text-base font-semibold text-slate-200">No risks registered</div>
            <div className="text-xs text-slate-400">Click &quot;New Risk&quot; above to document a risk exposure.</div>
          </div>
        ) : (
          <RiskTable risks={risks} />
        )}
      </section>

      {canWrite && (
        <RiskCreateModal
          isOpen={createOpen}
          onClose={() => setCreateOpen(false)}
          onSuccess={() => risksQuery.refetch()}
        />
      )}
    </div>
  );
}