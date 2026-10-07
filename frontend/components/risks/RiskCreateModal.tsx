"use client";

import React, { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api/client";
import { X, Loader2, AlertCircle } from "lucide-react";

interface RiskCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface ControlOption {
  control_id: string;
  code: string;
  title: string;
}

export default function RiskCreateModal({ isOpen, onClose, onSuccess }: RiskCreateModalProps) {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    likelihood: 3,
    impact: 3,
    treatment: "MITIGATE",
    treatment_plan: "",
    target_close_date: "",
  });

  const [availableControls, setAvailableControls] = useState<ControlOption[]>([]);
  const [selectedControls, setSelectedControls] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      apiFetch<ControlOption[]>("/v1/controls")
        .then((ctrls) => setAvailableControls(ctrls || []))
        .catch(() => setAvailableControls([]));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "likelihood" || name === "impact" ? parseInt(value, 10) : value,
    }));
  };

  const handleControlToggle = (controlId: string) => {
    setSelectedControls((prev) =>
      prev.includes(controlId) ? prev.filter((id) => id !== controlId) : [...prev, controlId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      await apiFetch("/v1/risks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description || null,
          likelihood: formData.likelihood,
          impact: formData.impact,
          treatment: formData.treatment,
          treatment_plan: formData.treatment_plan || null,
          target_close_date: formData.target_close_date
            ? new Date(formData.target_close_date).toISOString()
            : null,
          control_ids: selectedControls,
        }),
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setSubmitError(err.message || "Failed to register risk definition.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-2xl rounded-2xl border border-border bg-surface shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-100">
              Identify New Risk
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">
              Define risk title, likelihood & impact ratings, treatment roadmap, and linked controls.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-lg p-1.5 text-slate-500 transition hover:bg-surface-raised hover:text-slate-200 disabled:opacity-50 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5 max-h-[80vh] overflow-y-auto">
          {submitError && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-800/60 bg-rose-950/40 px-3 py-2.5 text-xs text-rose-400">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">
              Risk Title <span className="text-brand-orange">*</span>
            </label>
            <input
              type="text"
              name="title"
              required
              value={formData.title}
              onChange={handleChange}
              placeholder="e.g. Misconfigured public S3 bucket"
              className="w-full rounded-xl border border-border bg-surface-raised px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-orange/50"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">
              Description
            </label>
            <textarea
              name="description"
              rows={2}
              value={formData.description}
              onChange={handleChange}
              placeholder="Describe the vulnerability or risk exposure context..."
              className="w-full rounded-xl border border-border bg-surface-raised px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-orange/50 resize-none leading-relaxed"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">
                Likelihood (1–5)
              </label>
              <select
                name="likelihood"
                value={formData.likelihood}
                onChange={handleChange}
                className="w-full rounded-xl border border-border bg-surface-raised px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-orange/50 cursor-pointer"
              >
                {[1, 2, 3, 4, 5].map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">
                Impact (1–5)
              </label>
              <select
                name="impact"
                value={formData.impact}
                onChange={handleChange}
                className="w-full rounded-xl border border-border bg-surface-raised px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-orange/50 cursor-pointer"
              >
                {[1, 2, 3, 4, 5].map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">
                Treatment Strategy
              </label>
              <select
                name="treatment"
                value={formData.treatment}
                onChange={handleChange}
                className="w-full rounded-xl border border-border bg-surface-raised px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-orange/50 cursor-pointer"
              >
                <option value="MITIGATE">MITIGATE</option>
                <option value="AVOID">AVOID</option>
                <option value="TRANSFER">TRANSFER</option>
                <option value="ACCEPT">ACCEPT</option>
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">
                Target Close Date
              </label>
              <input
                type="date"
                name="target_close_date"
                value={formData.target_close_date}
                onChange={handleChange}
                className="w-full rounded-xl border border-border bg-surface-raised px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-orange/50 cursor-pointer"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">
              Treatment Plan
            </label>
            <textarea
              name="treatment_plan"
              rows={2}
              value={formData.treatment_plan}
              onChange={handleChange}
              placeholder="Enforce KMS encryption policies via AWS Config rule..."
              className="w-full rounded-xl border border-border bg-surface-raised px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-orange/50 resize-none leading-relaxed"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">
              Link Security Controls
            </label>
            <div className="max-h-36 overflow-y-auto rounded-xl border border-border bg-surface-raised p-2 space-y-1">
              {availableControls.map((c) => (
                <label
                  key={c.control_id}
                  className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer p-1.5 rounded hover:bg-surface transition"
                >
                  <input
                    type="checkbox"
                    checked={selectedControls.includes(c.control_id)}
                    onChange={() => handleControlToggle(c.control_id)}
                    className="rounded accent-brand-orange"
                  />
                  <span>
                    <strong className="font-mono text-brand-orange">{c.code}</strong> — {c.title}
                  </span>
                </label>
              ))}
              {availableControls.length === 0 && (
                <p className="p-3 text-center text-xs text-slate-500">No controls found to link.</p>
              )}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-xl px-4 py-2 text-sm text-slate-400 transition hover:bg-surface-raised hover:text-slate-200 disabled:opacity-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-orange px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-orange-hover disabled:opacity-60 cursor-pointer"
            >
              {isSubmitting && <Loader2 size={16} className="animate-spin" />}
              <span>{isSubmitting ? "Registering..." : "Save Risk"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export { RiskCreateModal };