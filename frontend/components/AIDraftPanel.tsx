"use client";

import React, { useState } from "react";
import { useAuth } from "@/lib/auth/context";
import { apiFetch } from "@/lib/api/client";
import { Sparkles, Check, X, Loader2, Bot, AlertCircle } from "lucide-react";

interface AIDraftPanelProps {
  type: "control" | "risk";
  resourceId: string;
  onApplied: (newText: string) => void;
}

interface DraftResponse {
  draft_id: string;
  review_token: string;
  output: string;
  model: string;
}

export function AIDraftPanel({ type, resourceId, onApplied }: AIDraftPanelProps) {
  const { can } = useAuth();

  const [loading, setLoading] = useState(false);
  const [approving, setApproving] = useState(false);
  const [reviewToken, setReviewToken] = useState<string | null>(null);
  const [draftOutput, setDraftOutput] = useState("");
  const [modelName, setModelName] = useState("Qwen2.5-7B-Instruct");
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // 1. Trigger SLM Generation
  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setToast(null);

    try {
      const endpoint = type === "control" ? "/v1/ai/draft/control" : "/v1/ai/draft/risk";
      const payload = type === "control" ? { control_id: resourceId } : { risk_id: resourceId };

      const res = await apiFetch<DraftResponse>(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      setReviewToken(res.review_token);
      setDraftOutput(res.output);
      if (res.model) setModelName(res.model);
    } catch (err: any) {
      setError(err.message || "Could not reach the SLM or generation failed.");
    } finally {
      setLoading(false);
    }
  };

  // 2. Approve and Apply Draft to the Resource
  const handleApprove = async () => {
    if (!reviewToken || !draftOutput.trim()) return;
    setApproving(true);
    setError(null);

    try {
      await apiFetch(`/v1/ai/draft/${reviewToken}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ edited_output: draftOutput }),
      });

      // Update parent without full page refresh
      onApplied(draftOutput);
      setToast("AI proposal approved and applied successfully.");
      setTimeout(() => setToast(null), 3000);

      // Collapse panel back to clean state
      setReviewToken(null);
      setDraftOutput("");
    } catch (err: any) {
      setError(err.message || "Failed to approve and apply draft.");
    } finally {
      setApproving(false);
    }
  };

  // 3. Discard Button: resets back to initial state immediately without dialog
  const handleDiscard = () => {
    setReviewToken(null);
    setDraftOutput("");
    setError(null);
  };

  // Scope check: User must hold ai:draft to see or use this feature
  if (!can(["ai:draft"])) return null;

  return (
    <div className="mt-4 pt-3 border-t border-border/60">
      {/* Toast Confirmation */}
      {toast && (
        <div className="mb-3 p-2.5 bg-emerald-950/60 border border-emerald-700/60 text-emerald-400 rounded-xl text-xs flex items-center gap-2">
          <Check size={14} />
          <span>{toast}</span>
        </div>
      )}

      {/* Inline Error */}
      {error && (
        <div className="mb-3 p-2.5 bg-rose-950/60 border border-rose-800 text-rose-300 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle size={14} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* State 1: Default Action Button */}
      {!reviewToken && !loading && (
        <button
          type="button"
          onClick={handleGenerate}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-surface border border-border hover:border-brand-orange text-xs text-slate-200 font-semibold transition-all shadow-sm group"
        >
          <Sparkles size={14} className="text-brand-orange group-hover:rotate-12 transition-transform" />
          <span>Draft with AI ({type === "control" ? "Control" : "Risk"} Description)</span>
        </button>
      )}

      {/* State 2: Pulsing Loading Skeleton */}
      {loading && (
        <div className="p-4 bg-surface rounded-xl border border-brand-orange/40 flex items-center gap-3 text-xs text-slate-300 font-mono animate-pulse shadow-md">
          <Bot size={18} className="text-brand-orange animate-spin" />
          <div>
            <div className="font-semibold text-brand-orange">SLM Reasoning Engine Active</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Generating improved proposal with {modelName}...</div>
          </div>
        </div>
      )}

      {/* State 3: Output Ready for Review */}
      {reviewToken && !loading && (
        <div className="p-4 bg-surface border border-border rounded-xl space-y-3 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-amber-950/80 text-amber-400 border border-amber-800/80 font-semibold">
                AI Draft — Requires Review
              </span>
              <span className="text-[10px] font-mono text-slate-500">
                Model: {modelName}
              </span>
            </div>

            <button
              type="button"
              onClick={handleDiscard}
              className="text-xs text-slate-400 hover:text-rose-400 flex items-center gap-1 transition-colors"
              title="Discard proposed draft"
            >
              <X size={13} />
              <span>Discard</span>
            </button>
          </div>

          <textarea
            rows={5}
            value={draftOutput}
            onChange={(e) => setDraftOutput(e.target.value)}
            placeholder="Review and edit the AI-generated text before approval..."
            className="w-full px-3 py-2 bg-surface-raised border border-border rounded-xl text-xs text-slate-200 focus:outline-none focus:border-brand-orange leading-relaxed font-sans"
          />

          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-slate-500">
              You can edit the proposal above directly before submitting.
            </span>

            {/* Approve Button: Visible only to roles with ai:approve (Compliance Manager, Tenant Admin; hidden from DPO) */}
            {can(["ai:approve"]) ? (
              <button
                type="button"
                onClick={handleApprove}
                disabled={approving || !draftOutput.trim()}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-semibold shadow transition-colors disabled:opacity-50"
              >
                {approving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                <span>Approve & Apply</span>
              </button>
            ) : (
              <span className="text-xs font-mono text-slate-500 italic">
                (View only — approval requires Compliance Manager or Admin)
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}