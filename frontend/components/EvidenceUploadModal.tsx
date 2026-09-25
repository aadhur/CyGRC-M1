"use client";

import React, { useState } from "react";
import { X, UploadCloud, Loader2, ShieldCheck, Check } from "lucide-react";
import { apiFetch } from "@/lib/api/client";

interface EvidenceUploadModalProps {
  controlId: string;
  controlCode: string;
  defaultRequirementId?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function EvidenceUploadModal({
  controlId,
  controlCode,
  defaultRequirementId = "",
  onClose,
  onSuccess,
}: EvidenceUploadModalProps) {
  const [requirementId, setRequirementId] = useState(defaultRequirementId);
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError("Please select an evidence file to upload.");
      return;
    }
    if (!requirementId.trim()) {
      setError("Requirement ID is required.");
      return;
    }

    setIsUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append("control_id", controlId);
    formData.append("requirement_id", requirementId.trim());
    formData.append("file", file);

    try {
      await apiFetch("/v1/evidence", {
        method: "POST",
        body: formData,
      });
      onSuccess();
    } catch (err: any) {
      setError(err.message || "Failed to upload evidence.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-lg shadow-2xl p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-100 transition-colors"
        >
          <X size={18} />
        </button>

        <span className="text-xs font-mono font-semibold tracking-wider text-brand-orange uppercase">
          EVIDENCE INTAKE
        </span>
        <h3 className="text-lg font-heading font-semibold text-slate-100 mt-1">
          Upload Evidence for {controlCode}
        </h3>

        {error && (
          <div className="mt-3 p-3 rounded-lg bg-rose-950/60 border border-rose-800/80 text-rose-300 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleUpload} className="space-y-4 mt-5">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Evidence Requirement ID
              </label>
              {defaultRequirementId && (
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/40">
                  Auto-detected from control
                </span>
              )}
            </div>
            <input
              type="text"
              required
              value={requirementId}
              onChange={(e) => setRequirementId(e.target.value)}
              placeholder="e.g. 01a0cddd-..."
              className="w-full px-3 py-2 bg-surface-raised border border-border rounded-xl text-xs text-slate-300 font-mono focus:outline-none focus:border-brand-orange"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Evidence Document / Screenshot
            </label>
            <div className="border-2 border-dashed border-border rounded-xl p-6 text-center hover:border-brand-orange transition-colors">
              <input
                type="file"
                required
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className="cursor-pointer flex flex-col items-center gap-2"
              >
                <UploadCloud size={28} className="text-brand-orange" />
                <span className="text-sm font-medium text-slate-200">
                  {file ? file.name : "Choose a file to upload"}
                </span>
                <span className="text-xs text-slate-500">
                  PDF, DOCX, CSV, or Image (SHA-256 computed on upload)
                </span>
              </label>
            </div>
          </div>

          <div className="p-3 bg-surface-raised border border-border rounded-xl flex items-center gap-2.5 text-xs text-slate-400">
            <ShieldCheck size={16} className="text-brand-orange shrink-0" />
            <span>Artifact will be securely stored in S3/MinIO and entered as Pending Review.</span>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-400 hover:text-slate-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isUploading}
              className="flex items-center gap-2 px-5 py-2 bg-brand-orange hover:bg-brand-orange-hover text-white text-sm font-semibold rounded-xl shadow disabled:opacity-50 transition-colors"
            >
              {isUploading && <Loader2 size={16} className="animate-spin" />}
              {isUploading ? "Uploading..." : "Submit Artifact"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}