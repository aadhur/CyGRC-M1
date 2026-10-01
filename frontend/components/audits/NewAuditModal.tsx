"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";

interface Framework {
  framework_id: string;
  name: string;
  code: string;
}

interface Control {
  control_id: string;
  code: string;
  title: string;
}

interface NewAuditModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function NewAuditModal({ open, onClose, onSuccess }: NewAuditModalProps) {
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [controls, setControls] = useState<Control[]>([]);
  const [frameworkId, setFrameworkId] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [selectedControls, setSelectedControls] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingFrameworks, setLoadingFrameworks] = useState(false);
  const [loadingControls, setLoadingControls] = useState(false);

  // Fetch frameworks on open
  useEffect(() => {
    if (!open) return;
    setLoadingFrameworks(true);
    api
      .get("/v1/frameworks")
      .then((res) => setFrameworks(res.data))
      .catch(() => setFrameworks([]))
      .finally(() => setLoadingFrameworks(false));
  }, [open]);

  // Fetch controls when framework changes
  useEffect(() => {
    if (!frameworkId) {
      setControls([]);
      setSelectedControls([]);
      return;
    }
    setLoadingControls(true);
    api
      .get(`/v1/controls?framework_id=${frameworkId}`)
      .then((res) => setControls(res.data))
      .catch(() => setControls([]))
      .finally(() => setLoadingControls(false));
    setSelectedControls([]);
  }, [frameworkId]);

  function toggleControl(id: string) {
    setSelectedControls((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  }

  function toggleAll() {
    if (selectedControls.length === controls.length) {
      setSelectedControls([]);
    } else {
      setSelectedControls(controls.map((c) => c.control_id));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!frameworkId || !periodStart || !periodEnd) {
      setError("Framework, start date, and end date are required.");
      return;
    }
    if (selectedControls.length === 0) {
      setError("Select at least one control.");
      return;
    }

    setSubmitting(true);
    try {
      await api.post("/v1/audits", {
        framework_id: frameworkId,
        period_start: periodStart,
        period_end: periodEnd,
        control_ids: selectedControls,
      });
      onSuccess();
      handleClose();
    } catch (err: any) {
      setError(
        err?.response?.data?.detail ?? "Failed to create audit cycle. Try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  function handleClose() {
    if (submitting) return;
    setFrameworkId("");
    setPeriodStart("");
    setPeriodEnd("");
    setSelectedControls([]);
    setError(null);
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm">
      <div className="relative w-full max-w-lg mx-4 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div>
            <h2 className="text-base font-semibold text-slate-100">Start Audit Cycle</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Select a framework, define the assessment period, and scope controls.
            </p>
          </div>
          <button
            onClick={handleClose}
            disabled={submitting}
            className="text-slate-500 hover:text-slate-300 transition-colors disabled:opacity-50"
            aria-label="Close modal"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          {/* Framework */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Framework <span className="text-rose-400">*</span>
            </label>
            {loadingFrameworks ? (
              <div className="h-9 bg-slate-800 rounded-lg animate-pulse" />
            ) : (
              <select
                value={frameworkId}
                onChange={(e) => setFrameworkId(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
                required
              >
                <option value="">Select a framework...</option>
                {frameworks.map((f) => (
                  <option key={f.framework_id} value={f.framework_id}>
                    {f.code} — {f.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Period Start <span className="text-rose-400">*</span>
              </label>
              <input
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Period End <span className="text-rose-400">*</span>
              </label>
              <input
                type="date"
                value={periodEnd}
                min={periodStart}
                onChange={(e) => setPeriodEnd(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
                required
              />
            </div>
          </div>

          {/* Controls Checklist */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-slate-400">
                Scoped Controls <span className="text-rose-400">*</span>
              </label>
              {controls.length > 0 && (
                <button
                  type="button"
                  onClick={toggleAll}
                  className="text-xs text-blue-400 hover:text-blue-300"
                >
                  {selectedControls.length === controls.length ? "Deselect all" : "Select all"}
                </button>
              )}
            </div>

            <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-700 bg-slate-800/50">
              {!frameworkId ? (
                <p className="text-xs text-slate-500 px-3 py-4 text-center">
                  Select a framework to load controls.
                </p>
              ) : loadingControls ? (
                <div className="space-y-2 p-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-4 bg-slate-700 rounded animate-pulse" />
                  ))}
                </div>
              ) : controls.length === 0 ? (
                <p className="text-xs text-slate-500 px-3 py-4 text-center">
                  No controls found for this framework.
                </p>
              ) : (
                <div className="divide-y divide-slate-700/50">
                  {controls.map((ctrl) => (
                    <label
                      key={ctrl.control_id}
                      className="flex items-start gap-3 px-3 py-2.5 hover:bg-slate-700/40 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedControls.includes(ctrl.control_id)}
                        onChange={() => toggleControl(ctrl.control_id)}
                        className="mt-0.5 accent-blue-500"
                      />
                      <span className="text-xs">
                        <span className="font-mono text-orange-400 font-medium">{ctrl.code}</span>
                        <span className="text-slate-300 ml-2">{ctrl.title}</span>
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {selectedControls.length > 0 && (
              <p className="text-xs text-slate-500 mt-1">
                {selectedControls.length} of {controls.length} selected
              </p>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-rose-950/40 border border-rose-800/60 text-rose-400 text-xs">
              <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={handleClose}
              disabled={submitting}
              className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
            >
              {submitting && (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
              )}
              {submitting ? "Creating..." : "Start Audit Cycle"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}