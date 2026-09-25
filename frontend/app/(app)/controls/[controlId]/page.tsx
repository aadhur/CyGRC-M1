"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth/context";
import { apiFetch } from "@/lib/api/client";
import { StatusBadge } from "@/components/StatusBadge";
import { EvidenceUploadModal } from "@/components/EvidenceUploadModal";
import {
  UploadCloud,
  Check,
  X,
  FileText,
  Loader2,
  User as UserIcon,
  FileCheck2,
} from "lucide-react";

interface ControlDetail {
  control_id: string;
  code: string;
  title: string;
  description: string;
  status: string;
  framework_id: string;
  owner: string;
  notes?: string | null;
  requirement_id?: string | null;
  owner_email?: string | null;
}

interface EvidenceItem {
  evidence_id: string;
  requirement_id?: string;
  source_ref: string;
  connector: string;
  sha256: string;
  review_status: string;
  collected_at: string;
}

interface Assignee {
  user_id: string;
  email: string;
  role: string;
}

export default function ControlDetailPage({
  params,
}: {
  params: Promise<{ controlId: string }>;
}) {
  const resolvedParams = use(params);
  const controlId = resolvedParams.controlId;
  const { can } = useAuth();

  const [control, setControl] = useState<ControlDetail | null>(null);
  const [evidenceList, setEvidenceList] = useState<EvidenceItem[]>([]);
  const [assignees, setAssignees] = useState<Assignee[]>([]);

  const [ownerInput, setOwnerInput] = useState("");
  const [notesInput, setNotesInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchControlData = async () => {
    try {
      const [ctrl, evRes, assigneeList] = await Promise.all([
        apiFetch<ControlDetail>(`/v1/controls/${controlId}`),
        apiFetch<{ evidence: EvidenceItem[] }>(`/v1/controls/${controlId}/evidence`),
        apiFetch<Assignee[]>("/v1/controls/assignees"),
      ]);
      setControl(ctrl);
      setOwnerInput(ctrl.owner || "");
      setNotesInput(ctrl.notes || "");
      setEvidenceList(evRes.evidence || []);
      setAssignees(assigneeList || []);
    } catch (err: any) {
      console.error("Failed to load control detail:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchControlData();
  }, [controlId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiFetch(`/v1/controls/${controlId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner: ownerInput, notes: notesInput }),
      });

      const updatedAssignee = assignees.find((a) => a.user_id === ownerInput);
      if (control) {
        setControl({
          ...control,
          owner: ownerInput,
          notes: notesInput,
          owner_email: updatedAssignee ? updatedAssignee.email : control.owner_email,
        });
      }
      setToast("Control updated successfully.");
      setTimeout(() => setToast(null), 3000);
    } catch (err: any) {
      setToast(err.message || "Failed to update control.");
    } finally {
      setSaving(false);
    }
  };

  const handleReview = async (evidenceId: string, decision: "APPROVED" | "REJECTED") => {
    try {
      await apiFetch(`/v1/evidence/${evidenceId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ review_status: decision }),
      });
      setEvidenceList((prev) =>
        prev.map((ev) =>
          ev.evidence_id === evidenceId ? { ...ev, review_status: decision } : ev
        )
      );
      setToast(`Evidence decision recorded as ${decision}.`);
      setTimeout(() => setToast(null), 3000);
    } catch (err: any) {
      setToast(err.message || "Review failed.");
    }
  };

  const prefilledRequirementId =
    control?.requirement_id ||
    evidenceList.find((e) => e.requirement_id)?.requirement_id ||
    "";

  if (loading) {
    return (
      <div className="p-16 flex items-center justify-center text-slate-400 gap-2">
        <Loader2 size={20} className="animate-spin" />
        <span>Loading control overview...</span>
      </div>
    );
  }

  if (!control) {
    return <div className="text-slate-400">Control not found.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href="/controls"
          className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
        >
          ← Back to controls
        </Link>
        {toast && (
          <div className="px-3 py-1.5 bg-brand-orange/20 border border-brand-orange/40 text-brand-orange rounded-xl text-xs flex items-center gap-2">
            <Check size={14} />
            <span>{toast}</span>
          </div>
        )}
      </div>

      <div className="p-6 bg-surface border border-border rounded-2xl flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-xl font-bold text-brand-orange">
              {control.code}
            </span>
            <StatusBadge status={control.status} />
          </div>
          <h1 className="text-2xl font-heading font-semibold text-slate-100 mt-2">
            {control.title}
          </h1>
        </div>

        {can(["evidence:write"]) && (
          <button
            onClick={() => setUploadOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-brand-orange hover:bg-brand-orange-hover text-white font-semibold text-xs rounded-xl shadow transition-colors"
          >
            <UploadCloud size={16} />
            <span>Upload Evidence</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <section className="p-6 bg-surface border border-border rounded-2xl space-y-3">
            <h2 className="text-xs font-mono uppercase text-slate-400 font-semibold tracking-wider flex items-center gap-2">
              <FileCheck2 size={16} className="text-brand-orange" />
              <span>Control Description</span>
            </h2>
            <p className="text-sm text-slate-200 leading-relaxed bg-surface-raised/50 p-4 rounded-xl border border-border">
              {control.description}
            </p>
          </section>

          <section className="p-6 bg-surface border border-border rounded-2xl">
            <h2 className="text-xs font-mono uppercase text-slate-400 font-semibold tracking-wider mb-4">
              Assignment & Operational Notes
            </h2>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                  Control Owner
                </label>
                {can(["controls:write"]) ? (
                  <select
                    value={ownerInput}
                    onChange={(e) => setOwnerInput(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-raised border border-border rounded-xl text-sm text-slate-200 focus:outline-none focus:border-brand-orange"
                  >
                    {assignees.map((a) => (
                      <option key={a.user_id} value={a.user_id}>
                        {a.email} ({a.role.replaceAll("_", " ")})
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="flex items-center gap-2 p-2.5 bg-surface-raised rounded-xl border border-border text-sm text-slate-200">
                    <UserIcon size={16} className="text-brand-orange shrink-0" />
                    <span>{control.owner_email || "Unassigned"}</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                  Operational Notes
                </label>
                {can(["controls:write"]) ? (
                  <textarea
                    value={notesInput}
                    onChange={(e) => setNotesInput(e.target.value)}
                    rows={4}
                    placeholder="Document implementation procedures or audit commentary..."
                    className="w-full px-3 py-2 bg-surface-raised border border-border rounded-xl text-sm text-slate-200 focus:outline-none focus:border-brand-orange leading-relaxed"
                  />
                ) : (
                  <div className="p-4 bg-surface-raised/60 rounded-xl border border-border text-sm text-slate-300">
                    {control.notes || "No operational notes added."}
                  </div>
                )}
              </div>

              {can(["controls:write"]) && (
                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2 bg-brand-orange hover:bg-brand-orange-hover text-white text-xs font-semibold rounded-xl shadow transition-colors disabled:opacity-50"
                  >
                    {saving ? "Saving Changes..." : "Save Changes"}
                  </button>
                </div>
              )}
            </form>
          </section>
        </div>

        <div className="space-y-6">
          <section className="p-6 bg-surface border border-border rounded-2xl space-y-3">
            <span className="text-xs font-mono uppercase text-slate-400 font-semibold tracking-wider">
              EVIDENCE REQUIREMENT
            </span>
            <div className="p-3 bg-surface-raised border border-border rounded-xl space-y-2">
              <div className="text-xs text-slate-300 font-medium">
                Annual Verification Document
              </div>
              <div className="text-[11px] font-mono text-slate-500 break-all">
                ID: {prefilledRequirementId || "Seeded Requirement"}
              </div>
            </div>
          </section>

          <section className="p-6 bg-surface border border-border rounded-2xl space-y-4">
            <span className="text-xs font-mono uppercase text-slate-400 font-semibold tracking-wider">
              Attached Artifacts ({evidenceList.length})
            </span>

            <div className="space-y-3">
              {evidenceList.map((ev) => (
                <div
                  key={ev.evidence_id}
                  className="p-3.5 bg-surface-raised border border-border rounded-xl flex flex-col gap-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <FileText size={16} className="text-brand-orange shrink-0" />
                      <span className="text-xs font-medium text-slate-200 truncate">
                        {ev.source_ref}
                      </span>
                    </div>
                    <StatusBadge status={ev.review_status} type="evidence" />
                  </div>

                  <div className="text-[10px] font-mono text-slate-500 truncate">
                    SHA256: {ev.sha256}
                  </div>

                  {can(["evidence:review"]) && ev.review_status === "PENDING" && (
                    <div className="flex items-center gap-2 pt-2 border-t border-border mt-1">
                      <button
                        onClick={() => handleReview(ev.evidence_id, "APPROVED")}
                        className="flex-1 py-1 rounded bg-emerald-950/60 border border-emerald-700/60 text-emerald-400 text-xs font-medium hover:bg-emerald-900/80 flex items-center justify-center gap-1"
                      >
                        <Check size={12} /> Approve
                      </button>
                      <button
                        onClick={() => handleReview(ev.evidence_id, "REJECTED")}
                        className="flex-1 py-1 rounded bg-rose-950/60 border border-rose-700/60 text-rose-400 text-xs font-medium hover:bg-rose-900/80 flex items-center justify-center gap-1"
                      >
                        <X size={12} /> Reject
                      </button>
                    </div>
                  )}
                </div>
              ))}

              {evidenceList.length === 0 && (
                <div className="p-8 text-center text-slate-500 text-xs">
                  No evidence uploaded yet. Click "Upload Evidence" above.
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      {uploadOpen && (
        <EvidenceUploadModal
          controlId={control.control_id}
          controlCode={control.code}
          defaultRequirementId={prefilledRequirementId}
          onClose={() => setUploadOpen(false)}
          onSuccess={() => {
            setUploadOpen(false);
            fetchControlData();
          }}
        />
      )}
    </div>
  );
}