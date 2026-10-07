"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth/context";
import { apiFetch } from "@/lib/api/client";
import { getScoreBadge } from "@/lib/design/status";
import { StatusBadge } from "@/components/StatusBadge";
import { ConfirmModal } from "@/components/ConfirmModal";
import { AIDraftPanel } from "@/components/AIDraftPanel";
import { ForbiddenState } from "@/components/ForbiddenState";
import {
  ShieldCheck,
  Check,
  Loader2,
  Calendar,
  Shield,
  Zap,
  RotateCcw,
  Save,
  ShieldAlert,
} from "lucide-react";

interface SingleRisk {
  risk_id: string;
  title: string;
  description?: string | null;
  likelihood: number;
  impact: number;
  inherent_score: number;
  residual_score?: number | null;
  treatment: "AVOID" | "MITIGATE" | "TRANSFER" | "ACCEPT";
  treatment_plan?: string | null;
  target_close_date?: string | null;
  status: string;
  control_ids: string[];
}

interface ControlSummary {
  control_id: string;
  code: string;
  title: string;
}

export default function RiskDetailPage({
  params,
}: {
  params: Promise<{ riskId: string }>;
}) {
  const resolvedParams = use(params);
  const riskId = resolvedParams.riskId;
  const { user, can } = useAuth();

  const [risk, setRisk] = useState<SingleRisk | null>(null);
  const [controlsMap, setControlsMap] = useState<Record<string, ControlSummary>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const [closeModalOpen, setCloseModalOpen] = useState(false);
  const [closeStatusChoice, setCloseStatusChoice] = useState<"CLOSED" | "ACCEPTED">("CLOSED");
  const [closing, setClosing] = useState(false);

  const [editForm, setEditForm] = useState({
    treatment: "MITIGATE",
    treatment_plan: "",
    likelihood: 3,
    impact: 3,
    target_close_date: "",
    status: "OPEN",
  });

  const fetchRiskData = async () => {
    try {
      const [res, allControls] = await Promise.all([
        apiFetch<SingleRisk>(`/v1/risks/${riskId}`),
        apiFetch<ControlSummary[]>("/v1/controls").catch(() => []),
      ]);
      setRisk(res);
      setEditForm({
        treatment: res.treatment || "MITIGATE",
        treatment_plan: res.treatment_plan || "",
        likelihood: res.likelihood,
        impact: res.impact,
        target_close_date: res.target_close_date ? res.target_close_date.split("T")[0] : "",
        status: res.status,
      });

      // Map control IDs to real code & title
      const map: Record<string, ControlSummary> = {};
      allControls.forEach((c) => {
        map[c.control_id] = c;
      });
      setControlsMap(map);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRiskData();
  }, [riskId]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiFetch(`/v1/risks/${riskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          treatment: editForm.treatment,
          treatment_plan: editForm.treatment_plan,
          likelihood: editForm.likelihood,
          impact: editForm.impact,
          status: editForm.status,
          target_close_date: editForm.target_close_date
            ? new Date(editForm.target_close_date).toISOString()
            : null,
        }),
      });
      await fetchRiskData();
      setToast("Risk details updated successfully.");
      setTimeout(() => setToast(null), 3000);
    } catch (err: any) {
      setToast(err.message || "Failed to update risk.");
    } finally {
      setSaving(false);
    }
  };

  const handleCloseConfirm = async () => {
    setClosing(true);
    try {
      await apiFetch(`/v1/risks/${riskId}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: closeStatusChoice }),
      });
      setCloseModalOpen(false);
      await fetchRiskData();
      setToast(`Risk marked as ${closeStatusChoice}.`);
      setTimeout(() => setToast(null), 3000);
    } catch (err: any) {
      alert(err.message || "Failed to close risk.");
    } finally {
      setClosing(false);
    }
  };

  if (!can(["risks:read"])) {
    return <ForbiddenState message="You do not possess permission to view risks." />;
  }

  if (loading) {
    return (
      <div className="p-16 flex items-center justify-center text-slate-400 gap-2">
        <Loader2 size={20} className="animate-spin text-brand-orange" />
        <span>Loading risk details...</span>
      </div>
    );
  }

  if (!risk) return <div className="text-slate-400">Risk not found.</div>;

  const scoreBadge = getScoreBadge(risk.inherent_score);
  const liveInherentScore = editForm.likelihood * editForm.impact;

  // Strict CISO check required by backend
  const isCiso = Boolean(user?.roles?.some((r) => r.toUpperCase() === "CISO"));
  const isHighRiskBlocked = risk.inherent_score >= 16 && !isCiso;
  const isClosedOrAccepted = risk.status === "CLOSED" || risk.status === "ACCEPTED";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href="/risks"
          className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
        >
          ← Back to risk register
        </Link>
        {toast && (
          <div className="px-3 py-1.5 bg-brand-orange/20 border border-brand-orange/40 text-brand-orange rounded-xl text-xs flex items-center gap-2">
            <Check size={14} />
            <span>{toast}</span>
          </div>
        )}
      </div>

      {/* Top Metadata Bar */}
      <div className="p-6 bg-surface border border-border rounded-2xl flex flex-wrap items-start justify-between gap-4 shadow-lg">
        <div>
          <div className="flex items-center gap-3">
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${scoreBadge.className}`}>
              Inherent Score: {risk.inherent_score} — {scoreBadge.label}
            </span>
            <StatusBadge status={risk.status} type="risk" />
          </div>
          <h1 className="text-2xl font-heading font-semibold text-slate-100 mt-2">
            {risk.title}
          </h1>
        </div>

        {can(["risks:close"]) && !isClosedOrAccepted && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCloseModalOpen(true)}
              disabled={isHighRiskBlocked}
              title={isHighRiskBlocked ? "Score ≥ 16 requires CISO sign-off." : undefined}
              className={`flex items-center gap-2 px-4 py-2 font-semibold text-xs rounded-xl shadow transition-colors ${
                isHighRiskBlocked
                  ? "bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-50"
                  : "bg-emerald-700 hover:bg-emerald-600 text-white cursor-pointer"
              }`}
            >
              <ShieldCheck size={16} />
              <span>Close / Accept Risk</span>
            </button>
            {isHighRiskBlocked && (
              <span className="text-[11px] font-mono text-amber-400">
                (Score ≥ 16 requires CISO sign-off)
              </span>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <section className="p-6 bg-surface border border-border rounded-2xl space-y-3 shadow-lg">
            <h2 className="text-xs font-mono uppercase text-slate-400 font-semibold tracking-wider flex items-center gap-2">
              <Shield size={16} className="text-brand-orange" />
              <span>Risk Description</span>
            </h2>
            <p className="text-sm text-slate-200 leading-relaxed bg-surface-raised/50 p-4 rounded-xl border border-border">
              {risk.description || "No description provided."}
            </p>

            <AIDraftPanel
              type="risk"
              resourceId={risk.risk_id}
              onApplied={(newDesc) => setRisk({ ...risk, description: newDesc })}
            />
          </section>

          <section className="p-6 bg-surface border border-border rounded-2xl shadow-lg">
            <h2 className="text-xs font-mono uppercase text-slate-400 font-semibold tracking-wider mb-4">
              Treatment Plan & Remediation Strategy
            </h2>

            <form onSubmit={handleUpdate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Likelihood (1–5)</label>
                  {can(["risks:write"]) ? (
                    <select
                      value={editForm.likelihood}
                      onChange={(e) => setEditForm({ ...editForm, likelihood: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-surface-raised border border-border rounded-xl text-sm text-slate-200 focus:outline-none focus:border-brand-orange cursor-pointer"
                    >
                      {[1, 2, 3, 4, 5].map((v) => (
                        <option key={v} value={v}>{v}</option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-sm text-slate-200 font-mono">{risk.likelihood} / 5</span>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Impact (1–5)</label>
                  {can(["risks:write"]) ? (
                    <select
                      value={editForm.impact}
                      onChange={(e) => setEditForm({ ...editForm, impact: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-surface-raised border border-border rounded-xl text-sm text-slate-200 focus:outline-none focus:border-brand-orange cursor-pointer"
                    >
                      {[1, 2, 3, 4, 5].map((v) => (
                        <option key={v} value={v}>{v}</option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-sm text-slate-200 font-mono">{risk.impact} / 5</span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Strategy</label>
                  {can(["risks:write"]) ? (
                    <select
                      value={editForm.treatment}
                      onChange={(e) => setEditForm({ ...editForm, treatment: e.target.value as any })}
                      className="w-full px-3 py-2 bg-surface-raised border border-border rounded-xl text-sm text-slate-200 focus:outline-none focus:border-brand-orange cursor-pointer"
                    >
                      <option value="MITIGATE">MITIGATE</option>
                      <option value="AVOID">AVOID</option>
                      <option value="TRANSFER">TRANSFER</option>
                      <option value="ACCEPT">ACCEPT</option>
                    </select>
                  ) : (
                    <span className="text-sm text-slate-200">{risk.treatment}</span>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Target Close Date</label>
                  {can(["risks:write"]) ? (
                    <input
                      type="date"
                      value={editForm.target_close_date}
                      onChange={(e) => setEditForm({ ...editForm, target_close_date: e.target.value })}
                      className="w-full px-3 py-2 bg-surface-raised border border-border rounded-xl text-sm text-slate-200 focus:outline-none focus:border-brand-orange cursor-pointer"
                    />
                  ) : (
                    <span className="text-sm text-slate-200">{risk.target_close_date?.split("T")[0] || "None"}</span>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Treatment Plan</label>
                {can(["risks:write"]) ? (
                  <textarea
                    rows={4}
                    value={editForm.treatment_plan}
                    onChange={(e) => setEditForm({ ...editForm, treatment_plan: e.target.value })}
                    placeholder="Document actionable mitigation roadmap..."
                    className="w-full px-3 py-2 bg-surface-raised border border-border rounded-xl text-sm text-slate-200 focus:outline-none focus:border-brand-orange leading-relaxed"
                  />
                ) : (
                  <div className="p-4 bg-surface-raised/60 rounded-xl border border-border text-sm text-slate-300">
                    {risk.treatment_plan || "No treatment plan entered."}
                  </div>
                )}
              </div>

              {can(["risks:write"]) && (
                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex items-center gap-1.5 px-5 py-2 bg-brand-orange hover:bg-brand-orange-hover text-white text-xs font-semibold rounded-xl shadow transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {saving && <Loader2 size={13} className="animate-spin" />}
                    <span>Save Changes</span>
                  </button>
                </div>
              )}
            </form>
          </section>
        </div>

        {/* Right Column: Inherent Score & Linked Controls */}
        <div className="space-y-6">
          <section className="p-6 bg-surface border border-border rounded-2xl shadow-lg space-y-4">
            <h2 className="text-xs font-mono uppercase text-slate-400 font-semibold tracking-wider flex items-center gap-2">
              <Zap size={16} className="text-amber-400" />
              <span>Risk Assessment</span>
            </h2>

            <div className={`p-4 rounded-xl border text-center ${scoreBadge.className}`}>
              <div className="text-3xl font-heading font-extrabold">{risk.inherent_score}</div>
              <div className="text-xs uppercase font-semibold mt-1">{scoreBadge.label} Severity</div>
              <div className="text-[11px] opacity-75 font-mono mt-0.5">
                Likelihood ({risk.likelihood}) × Impact ({risk.impact})
              </div>
            </div>

            <div className="p-3 bg-surface-raised/50 rounded-xl border border-border text-xs text-slate-400 space-y-1">
              <div><strong>Policy Standard:</strong> Inherent Scores ≥ 16 require explicit CISO sign-off to close.</div>
            </div>
          </section>

          {/* Linked Controls Box with Code & Title */}
          <section className="p-6 bg-surface border border-border rounded-2xl shadow-lg space-y-3">
            <span className="text-xs font-mono uppercase text-slate-400 font-semibold tracking-wider">
              LINKED CONTROLS ({risk.control_ids.length} {risk.control_ids.length === 1 ? "control" : "controls"})
            </span>
            <div className="space-y-2">
              {risk.control_ids.map((cid) => {
                const ctrl = controlsMap[cid];
                return (
                  <div key={cid} className="p-2.5 bg-surface-raised rounded-xl border border-border text-xs text-slate-200">
                    <span className="font-mono font-bold text-brand-orange">{ctrl?.code || cid.slice(0, 8)}</span>
                    <span className="text-slate-400 ml-1.5">— {ctrl?.title || "Linked Security Control"}</span>
                  </div>
                );
              })}
              {risk.control_ids.length === 0 && (
                <div className="text-xs text-slate-500">No controls mapped to this risk.</div>
              )}
            </div>
          </section>
        </div>
      </div>

      {/* Close Risk Modal */}
      {closeModalOpen && (
        <ConfirmModal
          isOpen={true}
          title="Close / Accept Risk Exposure"
          description={`Select the closing disposition for "${risk.title}". A treatment plan must be established before closing.`}
          confirmText={`Mark as ${closeStatusChoice}`}
          variant="warning"
          isLoading={closing}
          onConfirm={handleCloseConfirm}
          onClose={() => setCloseModalOpen(false)}
        >
          <div className="space-y-3">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
              Resolution Disposition
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setCloseStatusChoice("CLOSED")}
                className={`p-2.5 rounded-xl border text-xs font-semibold text-center transition cursor-pointer ${
                  closeStatusChoice === "CLOSED"
                    ? "bg-emerald-950/60 text-emerald-400 border-emerald-600"
                    : "bg-surface-raised text-slate-400 border-border hover:text-slate-200"
                }`}
              >
                CLOSED
              </button>
              <button
                type="button"
                onClick={() => setCloseStatusChoice("ACCEPTED")}
                className={`p-2.5 rounded-xl border text-xs font-semibold text-center transition cursor-pointer ${
                  closeStatusChoice === "ACCEPTED"
                    ? "bg-purple-950/60 text-purple-400 border-purple-600"
                    : "bg-surface-raised text-slate-400 border-border hover:text-slate-200"
                }`}
              >
                ACCEPTED
              </button>
            </div>
          </div>
        </ConfirmModal>
      )}
    </div>
  );
}