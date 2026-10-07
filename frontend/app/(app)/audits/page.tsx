"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth/context";
import { apiFetch } from "@/lib/api/client";
import { StatusBadge } from "@/components/StatusBadge";
import { ForbiddenState } from "@/components/ForbiddenState";
import { Plus, X, ArrowRight, Loader2, Calendar } from "lucide-react";

interface AuditSummary {
  audit_id: string;
  framework_id: string;
  period_start: string;
  period_end: string;
  status: string;
  scoped_control_count: number;
}

interface FrameworkItem {
  framework_id: string;
  code: string;
}

interface ControlItem {
  control_id: string;
  code: string;
  title: string;
}

export default function AuditsPage() {
  const { can } = useAuth();
  const [audits, setAudits] = useState<AuditSummary[]>([]);
  const [frameworks, setFrameworks] = useState<FrameworkItem[]>([]);
  const [controls, setControls] = useState<ControlItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const [form, setForm] = useState({
    framework_id: "",
    period_start: "",
    period_end: "",
    control_ids: [] as string[],
  });

  const loadData = async () => {
    try {
      const [auditList, fwList] = await Promise.all([
        apiFetch<AuditSummary[]>("/v1/audits"),
        apiFetch<FrameworkItem[]>("/v1/frameworks"),
      ]);
      setAudits(auditList || []);
      setFrameworks(fwList || []);
      if (fwList.length > 0 && !form.framework_id) {
        setForm((prev) => ({ ...prev, framework_id: fwList[0].framework_id }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (form.framework_id) {
      apiFetch<ControlItem[]>(`/v1/controls?framework_id=${form.framework_id}`)
        .then(setControls)
        .catch(() => setControls([]));
    }
  }, [form.framework_id]);

  const handleCreateAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      await apiFetch("/v1/audits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setModalOpen(false);
      await loadData();
    } catch (err: any) {
      alert(err.message || "Failed to start audit cycle.");
    } finally {
      setCreating(false);
    }
  };

  if (!can(["audits:read"])) {
    return <ForbiddenState message="You do not possess permission to view audits." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-mono font-semibold tracking-wider text-brand-orange uppercase">
            ASSURANCE & ATTESTATION
          </p>
          <h1 className="text-2xl font-heading font-bold text-slate-100 mt-1">
            Audit Cycles
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Execute scoped control reviews, raise findings, and generate signed executive reports.
          </p>
        </div>

        {can(["audits:write"]) && (
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-brand-orange hover:bg-brand-orange-hover text-white text-xs font-semibold rounded-xl shadow transition-colors"
          >
            <Plus size={16} />
            <span>Start Audit Cycle</span>
          </button>
        )}
      </div>

      <section className="bg-surface border border-border rounded-2xl overflow-hidden shadow-lg">
        {loading ? (
          <div className="p-16 flex items-center justify-center text-slate-400 gap-2">
            <Loader2 size={20} className="animate-spin" />
            <span>Loading audit cycles...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-raised/60 text-xs font-mono uppercase text-slate-400 border-b border-border">
                <tr>
                  <th className="px-6 py-4">Assessment Period</th>
                  <th className="px-6 py-4">Framework</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Scoped Controls</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {audits.map((a) => (
                  <tr
                    key={a.audit_id}
                    className="hover:bg-surface-raised/40 transition-colors group cursor-pointer"
                  >
                    <td className="px-6 py-4 font-semibold text-slate-200">
                      <Link href={`/audits/${a.audit_id}`} className="flex items-center gap-2">
                        <Calendar size={15} className="text-brand-orange" />
                        <span>
                          {a.period_start?.split("T")[0]} to {a.period_end?.split("T")[0]}
                        </span>
                      </Link>
                    </td>

                    <td className="px-6 py-4 font-mono text-xs text-slate-300">
                      {frameworks.find((f) => f.framework_id === a.framework_id)?.code || a.framework_id.slice(0, 8)}
                    </td>

                    <td className="px-6 py-4">
                      <StatusBadge status={a.status} type="audit" />
                    </td>

                    <td className="px-6 py-4 text-center text-xs font-mono text-slate-400">
                      {a.scoped_control_count} 
                    </td>

                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/audits/${a.audit_id}`}
                        className="inline-flex items-center gap-1 text-xs text-slate-400 group-hover:text-brand-orange transition-colors"
                      >
                        <span>Open Audit</span>
                        <ArrowRight size={14} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {audits.length === 0 && (
              <div className="p-12 text-center text-slate-500 text-sm">
                No active or closed audits. Click "Start Audit Cycle" above.
              </div>
            )}
          </div>
        )}
      </section>

      {/* Start Audit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-lg p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setModalOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-100"
            >
              <X size={18} />
            </button>
            <h3 className="text-lg font-heading font-semibold text-slate-100 mb-4">
              Start Audit Assessment Cycle
            </h3>

            <form onSubmit={handleCreateAudit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Target Framework</label>
                <select
                  required
                  value={form.framework_id}
                  onChange={(e) => setForm({ ...form, framework_id: e.target.value, control_ids: [] })}
                  className="w-full px-3 py-2 bg-surface-raised border border-border rounded-xl text-sm text-slate-200 focus:outline-none focus:border-brand-orange"
                >
                  {frameworks.map((f) => (
                    <option key={f.framework_id} value={f.framework_id}>{f.code}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Period Start</label>
                  <input
                    required
                    type="date"
                    value={form.period_start}
                    onChange={(e) => setForm({ ...form, period_start: e.target.value })}
                    className="w-full px-3 py-2 bg-surface-raised border border-border rounded-xl text-sm text-slate-200 focus:outline-none focus:border-brand-orange"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Period End</label>
                  <input
                    required
                    type="date"
                    value={form.period_end}
                    onChange={(e) => setForm({ ...form, period_end: e.target.value })}
                    className="w-full px-3 py-2 bg-surface-raised border border-border rounded-xl text-sm text-slate-200 focus:outline-none focus:border-brand-orange"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Select Scoped Controls</label>
                <div className="max-h-40 overflow-y-auto border border-border rounded-xl p-2 space-y-1 bg-surface-raised/40">
                  {controls.map((c) => (
                    <label key={c.control_id} className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer p-1 rounded hover:bg-surface-raised">
                      <input
                        type="checkbox"
                        checked={form.control_ids.includes(c.control_id)}
                        onChange={(e) => {
                          const updated = e.target.checked
                            ? [...form.control_ids, c.control_id]
                            : form.control_ids.filter((id) => id !== c.control_id);
                          setForm({ ...form, control_ids: updated });
                        }}
                        className="rounded"
                      />
                      <span><strong>{c.code}</strong> - {c.title}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-400 hover:text-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-5 py-2 bg-brand-orange hover:bg-brand-orange-hover text-white text-xs font-semibold rounded-xl shadow disabled:opacity-50"
                >
                  {creating ? "Launching..." : "Launch Cycle"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}