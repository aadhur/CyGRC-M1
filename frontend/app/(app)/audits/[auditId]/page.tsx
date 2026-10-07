"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth/context";
import { apiFetch } from "@/lib/api/client";
import { AUDIT_VERDICTS, FINDING_SEVERITIES } from "@/lib/design/status";
import { StatusBadge } from "@/components/StatusBadge";
import { ConfirmModal } from "@/components/ConfirmModal";
import { ForbiddenState } from "@/components/ForbiddenState";
import {
  Download,
  ShieldCheck,
  X,
  FileCheck2,
  AlertTriangle,
  Loader2,
  Calendar,
} from "lucide-react";

interface AuditDetail {
  audit_id: string;
  framework_id: string;
  period_start: string;
  period_end: string;
  status: string;
  scoped_control_count: number;
  control_ids: string[];
}

interface AuditControlRow {
  control: {
    control_id: string;
    code: string;
    title: string;
    owner: string;
    owner_email?: string | null;
    status: string;
  };
  review: {
    verdict: "PASS" | "FAIL" | "EXCEPTION";
    notes?: string | null;
  } | null;
}

interface FindingItem {
  finding_id: string;
  control_id: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  description: string;
  recommendation?: string | null;
  due_date?: string | null;
  status: "OPEN" | "IN_REMEDIATION" | "CLOSED";
}

interface Assignee {
  user_id: string;
  email: string;
}

export default function SingleAuditPage({
  params,
}: {
  params: Promise<{ auditId: string }>;
}) {
  const resolvedParams = use(params);
  const auditId = resolvedParams.auditId;
  const { can } = useAuth();

  const [audit, setAudit] = useState<AuditDetail | null>(null);
  const [controls, setControls] = useState<AuditControlRow[]>([]);
  const [findings, setFindings] = useState<FindingItem[]>([]);
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [activeTab, setActiveTab] = useState<"controls" | "findings">("controls");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [signOffModal, setSignOffModal] = useState(false);
  const [signingOff, setSigningOff] = useState(false);

  const [findingModalOpen, setFindingModalOpen] = useState(false);
  const [findingForm, setFindingForm] = useState({
    control_id: "",
    severity: "HIGH" as const,
    description: "",
    recommendation: "",
    owner: "",
    due_date: "",
  });

  const loadAuditData = async () => {
    try {
      const [auditMeta, ctrlRows, findingRows, assigneeList] = await Promise.all([
        apiFetch<AuditDetail>(`/v1/audits/${auditId}`),
        apiFetch<AuditControlRow[]>(`/v1/audits/${auditId}/controls`),
        apiFetch<FindingItem[]>(`/v1/audits/${auditId}/findings`).catch(() => []),
        apiFetch<Assignee[]>("/v1/controls/assignees").catch(() => []),
      ]);
      setAudit(auditMeta);
      setControls(ctrlRows || []);
      setFindings(findingRows || []);
      setAssignees(assigneeList || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAuditData();
  }, [auditId]);

  const handleExportPdf = async () => {
    setExporting(true);
    try {
      const token =
        document.cookie.split("cygrc_access_token=")[1]?.split(";")[0] ||
        document.cookie.split("access_token=")[1]?.split(";")[0] ||
        "";

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000"}/v1/audits/${auditId}/export`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (!res.ok) throw new Error("PDF generation failed");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit_report_${auditId}.pdf`;
      a.click();
    } catch (err: any) {
      alert(err.message || "Failed to download PDF.");
    } finally {
      setExporting(false);
    }
  };

  const handleSignOff = async () => {
    setSigningOff(true);
    try {
      const res = await apiFetch<any>(`/v1/audits/${auditId}/sign-off`, { method: "POST" });
      setSignOffModal(false);
      setAudit((prev) =>
        prev
          ? {
              ...prev,
              status: "CLOSED",
              signed_off_by: res?.signed_off_by,
            }
          : null
      );
      await loadAuditData();
    } catch (err: any) {
      alert(err.message || "Sign-off failed.");
    } finally {
      setSigningOff(false);
    }
  };

  const handleVerdictChange = async (controlId: string, verdict: "PASS" | "FAIL" | "EXCEPTION") => {
    try {
      await apiFetch(`/v1/audits/${auditId}/controls/${controlId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verdict }),
      });
      setControls((prev) =>
        prev.map((c) =>
          c.control.control_id === controlId
            ? { ...c, review: { verdict, notes: c.review?.notes } }
            : c
        )
      );
    } catch (err: any) {
      alert(err.message || "Failed to update review.");
    }
  };

  const handleCreateFinding = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch(`/v1/audits/${auditId}/findings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...findingForm,
          due_date: new Date(findingForm.due_date).toISOString(),
        }),
      });
      setFindingModalOpen(false);
      setFindingForm({
        control_id: controls[0]?.control.control_id || "",
        severity: "HIGH",
        description: "",
        recommendation: "",
        owner: "",
        due_date: "",
      });
      await loadAuditData();
    } catch (err: any) {
      alert(err.message || "Failed to create finding.");
    }
  };

  if (!can(["audits:read"])) {
    return <ForbiddenState message="You do not possess permission to view audit cycles." />;
  }

  if (loading) {
    return (
      <div className="p-16 flex items-center justify-center text-slate-400 gap-2">
        <Loader2 size={20} className="animate-spin text-brand-orange" />
        <span>Loading audit assessment...</span>
      </div>
    );
  }

  if (!audit) return <div className="text-slate-400">Audit not found.</div>;

  return (
    <div className="space-y-6 pt-3 pb-8">
      {/* Back Link with proper breathing room */}
      <div>
        <Link
          href="/audits"
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
        >
          ← Back to audit cycles
        </Link>
      </div>

      {/* Top Action Bar */}
      <div className="p-6 bg-surface border border-border rounded-2xl flex flex-wrap items-center justify-between gap-4 shadow-lg">
        <div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs text-slate-400 flex items-center gap-1.5">
              <Calendar size={14} className="text-brand-orange" />
              {audit.period_start?.split("T")[0]} to {audit.period_end?.split("T")[0]}
            </span>
            <StatusBadge status={audit.status} type="audit" />
          </div>
          <h1 className="text-2xl font-heading font-semibold text-slate-100 mt-1">
            Compliance & Controls Assessment
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExportPdf}
            disabled={exporting}
            className="flex items-center gap-1.5 px-4 py-2 bg-surface-raised border border-border hover:border-brand-orange text-xs text-slate-200 font-semibold rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
          >
            {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            <span>Export PDF Report</span>
          </button>

          {audit.status !== "CLOSED" ? (
            <button
              onClick={() => setSignOffModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white font-semibold text-xs rounded-xl shadow transition-colors cursor-pointer"
            >
              <ShieldCheck size={16} />
              <span>Sign Off & Close</span>
            </button>
          ) : (
            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-950/60 border border-emerald-700/60 text-emerald-400 text-xs font-mono font-semibold rounded-xl">
              <ShieldCheck size={14} />
              <span>Signed Off & Closed</span>
            </span>
          )}
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex items-center gap-3 border-b border-border pb-3">
        <button
          onClick={() => setActiveTab("controls")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
            activeTab === "controls"
              ? "bg-brand-orange text-white shadow-sm"
              : "text-slate-400 hover:text-slate-200 hover:bg-surface-raised"
          }`}
        >
          <FileCheck2 size={15} />
          <span>Scoped Controls Review ({controls.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("findings")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
            activeTab === "findings"
              ? "bg-brand-orange text-white shadow-sm"
              : "text-slate-400 hover:text-slate-200 hover:bg-surface-raised"
          }`}
        >
          <AlertTriangle size={15} />
          <span>Findings Log ({findings.length})</span>
        </button>
      </div>

      {/* Tab 1: Controls Review */}
      {activeTab === "controls" && (
        <section className="bg-surface border border-border rounded-2xl overflow-hidden shadow-lg">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-raised/60 text-xs font-mono uppercase text-slate-400 border-b border-border">
              <tr>
                <th className="px-6 py-4">Control</th>
                <th className="px-6 py-4">Owner</th>
                <th className="px-6 py-4">Current Status</th>
                <th className="px-6 py-4">Audit Verdict</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {controls.map((c) => {
                const verdict = c.review?.verdict;
                return (
                  <tr key={c.control.control_id} className="hover:bg-surface-raised/30 transition-colors">
                    <td className="px-6 py-4">
                      <span className="font-mono font-bold text-brand-orange">{c.control.code}</span>
                      <div className="text-xs text-slate-300 font-medium mt-0.5">{c.control.title}</div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-surface-raised border border-border flex items-center justify-center text-[10px] font-bold text-brand-orange shrink-0 font-mono">
                          {(assignees.find((a) => a.user_id === c.control.owner)?.email || c.control.owner_email || "AD").slice(0, 2).toUpperCase()}
                        </div>
                        <span className="text-xs text-slate-200 truncate max-w-[200px]" title={c.control.owner}>
                          {assignees.find((a) => a.user_id === c.control.owner)?.email || c.control.owner_email || "Tenant Admin"}
                        </span>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <StatusBadge status={c.control.status} />
                    </td>

                    <td className="px-6 py-4">
                      {audit.status !== "CLOSED" ? (
                        <select
                          value={verdict || "PASS"}
                          onChange={(e) => handleVerdictChange(c.control.control_id, e.target.value as any)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium focus:outline-none bg-surface-raised border cursor-pointer ${
                            verdict ? AUDIT_VERDICTS[verdict] : "border-border text-slate-400"
                          }`}
                        >
                          <option value="PASS">PASS</option>
                          <option value="FAIL">FAIL</option>
                          <option value="EXCEPTION">EXCEPTION</option>
                        </select>
                      ) : (
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${verdict ? AUDIT_VERDICTS[verdict] : "text-slate-400 border-border"}`}>
                          {verdict || "Pending"}
                        </span>
                      )}
                    </td>

                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => {
                          setFindingForm((prev) => ({ ...prev, control_id: c.control.control_id }));
                          setFindingModalOpen(true);
                        }}
                        className="px-3 py-1 bg-surface-raised border border-border hover:border-brand-orange text-xs text-slate-200 font-medium rounded-lg transition-colors cursor-pointer"
                      >
                        Raise Finding
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      {/* Tab 2: Findings Log */}
      {activeTab === "findings" && (
        <section className="bg-surface border border-border rounded-2xl overflow-hidden shadow-lg">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-raised/60 text-xs font-mono uppercase text-slate-400 border-b border-border">
              <tr>
                <th className="px-6 py-4">Severity</th>
                <th className="px-6 py-4">Description</th>
                <th className="px-6 py-4">Recommendation</th>
                <th className="px-6 py-4">Due Date</th>
                <th className="px-6 py-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {findings.map((f) => (
                <tr key={f.finding_id} className="hover:bg-surface-raised/30 transition-colors">
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${FINDING_SEVERITIES[f.severity]}`}>
                      {f.severity}
                    </span>
                  </td>

                  <td className="px-6 py-4 text-xs text-slate-200 max-w-sm">
                    {f.description}
                  </td>

                  <td className="px-6 py-4 text-xs text-slate-400 max-w-xs">
                    {f.recommendation || "—"}
                  </td>

                  <td className="px-6 py-4 text-xs font-mono text-slate-400">
                    {f.due_date?.split("T")[0] || "—"}
                  </td>

                  <td className="px-6 py-4 text-right">
                    <span className="text-xs font-mono px-2.5 py-1 rounded bg-surface-raised border border-border text-slate-300">
                      {f.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {findings.length === 0 && (
            <div className="p-12 text-center text-slate-500 text-sm">
              No findings raised for this audit cycle.
            </div>
          )}
        </section>
      )}

      {/* Sign Off Confirmation Modal */}
      <ConfirmModal
        isOpen={signOffModal}
        title="Sign Off & Close Audit Cycle"
        description='Attestation Statement: "I confirm that all control verdicts and associated remediation findings have been reviewed and accepted per organizational policy."'
        confirmText="Attest & Sign Off"
        variant="warning"
        isLoading={signingOff}
        onConfirm={handleSignOff}
        onClose={() => setSignOffModal(false)}
      />

      {/* Raise Finding Modal */}
      {findingModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-lg p-6 shadow-2xl relative">
            <button
              onClick={() => setFindingModalOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-100 cursor-pointer"
            >
              <X size={18} />
            </button>
            <h3 className="text-lg font-heading font-semibold text-slate-100 mb-4">
              Raise Audit Finding
            </h3>

            <form onSubmit={handleCreateFinding} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Target Scoped Control</label>
                <select
                  required
                  value={findingForm.control_id}
                  onChange={(e) => setFindingForm({ ...findingForm, control_id: e.target.value })}
                  className="w-full px-3 py-2 bg-surface-raised border border-border rounded-xl text-sm text-slate-200 focus:outline-none focus:border-brand-orange cursor-pointer"
                >
                  {controls.map((c) => (
                    <option key={c.control.control_id} value={c.control.control_id}>
                      {c.control.code} — {c.control.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Finding Severity</label>
                <select
                  value={findingForm.severity}
                  onChange={(e) => setFindingForm({ ...findingForm, severity: e.target.value as any })}
                  className="w-full px-3 py-2 bg-surface-raised border border-border rounded-xl text-sm text-slate-200 focus:outline-none focus:border-brand-orange cursor-pointer"
                >
                  <option value="CRITICAL">CRITICAL</option>
                  <option value="HIGH">HIGH</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="LOW">LOW</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Description</label>
                <textarea
                  required
                  rows={3}
                  value={findingForm.description}
                  onChange={(e) => setFindingForm({ ...findingForm, description: e.target.value })}
                  placeholder="Detail the non-compliance observation..."
                  className="w-full px-3 py-2 bg-surface-raised border border-border rounded-xl text-sm text-slate-200 focus:outline-none focus:border-brand-orange"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Recommendation</label>
                <textarea
                  rows={2}
                  value={findingForm.recommendation}
                  onChange={(e) => setFindingForm({ ...findingForm, recommendation: e.target.value })}
                  placeholder="Actionable remediation steps..."
                  className="w-full px-3 py-2 bg-surface-raised border border-border rounded-xl text-sm text-slate-200 focus:outline-none focus:border-brand-orange"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Remediation Owner</label>
                  <select
                    value={findingForm.owner}
                    onChange={(e) => setFindingForm({ ...findingForm, owner: e.target.value })}
                    className="w-full px-3 py-2 bg-surface-raised border border-border rounded-xl text-sm text-slate-200 focus:outline-none focus:border-brand-orange cursor-pointer"
                  >
                    <option value="">Unassigned</option>
                    {assignees.map((a) => (
                      <option key={a.user_id} value={a.user_id}>{a.email}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Due Date</label>
                  <input
                    required
                    type="date"
                    value={findingForm.due_date}
                    onChange={(e) => setFindingForm({ ...findingForm, due_date: e.target.value })}
                    className="w-full px-3 py-2 bg-surface-raised border border-border rounded-xl text-sm text-slate-200 focus:outline-none focus:border-brand-orange cursor-pointer"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setFindingModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-400 hover:text-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-brand-orange hover:bg-brand-orange-hover text-white text-xs font-semibold rounded-xl cursor-pointer"
                >
                  Raise Finding
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}