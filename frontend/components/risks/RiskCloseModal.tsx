"use client";

import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import ConfirmModal from "@/components/ConfirmModal";
import { apiFetch } from "@/lib/api/client";
import { ShieldCheck, CheckCircle2 } from "lucide-react";

interface RiskCloseModalProps {
  isOpen: boolean;
  onClose: () => void;
  riskId: string;
  riskTitle: string;
  inherentScore: number;
  hasTreatmentPlan: boolean;
  onSuccess?: () => void;
}

interface ApiError {
  response?: {
    data?: {
      detail?: string;
    };
  };
  detail?: string;
  message?: string;
}

function sanitizeErrorMessage(err: unknown): string {
  if (!err) return "An unexpected error occurred while closing the risk.";
  let msg = "";
  if (typeof err === "object" && err !== null) {
    const errorObj = err as ApiError;
    msg =
      errorObj.response?.data?.detail ||
      errorObj.detail ||
      errorObj.message ||
      "";
  } else if (typeof err === "string") {
    msg = err;
  }

  // Guard against exposing raw SQL/backend crashes
  if (
    /sql|syntax|asyncpg|postgres|psycopg|select|insert|update|delete|table|relation|column/i.test(
      msg,
    )
  ) {
    return "A database error occurred. Please contact support or try again.";
  }

  return msg || "Failed to close risk.";
}

export function RiskCloseModal({
  isOpen,
  onClose,
  riskId,
  riskTitle,
  inherentScore,
  hasTreatmentPlan,
  onSuccess,
}: RiskCloseModalProps) {
  const queryClient = useQueryClient();
  const [selectedStatus, setSelectedStatus] = useState<"CLOSED" | "ACCEPTED">(
    "CLOSED",
  );
  const [mutationError, setMutationError] = useState<string | null>(null);

  const closeMutation = useMutation({
    mutationFn: async (status: "CLOSED" | "ACCEPTED") => {
      setMutationError(null);
      return apiFetch(`/v1/risks/${riskId}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
    },
    onSuccess: () => {
      toast.success(
        selectedStatus === "CLOSED"
          ? "Risk successfully closed."
          : "Risk successfully marked as accepted.",
      );
      queryClient.invalidateQueries({ queryKey: ["risk", riskId] });
      queryClient.invalidateQueries({ queryKey: ["risks"] });
      onSuccess?.();
      onClose();
    },
    onError: (err: unknown) => {
      const sanitized = sanitizeErrorMessage(err);
      setMutationError(sanitized);
      toast.error(sanitized);
    },
  });

  const handleConfirm = () => {
    if (!hasTreatmentPlan) {
      setMutationError(
        "Cannot close a risk with no treatment plan. Please update the treatment plan before closing.",
      );
      return;
    }
    closeMutation.mutate(selectedStatus);
  };

  const isHighRisk = inherentScore >= 16;

  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={() => {
        setMutationError(null);
        onClose();
      }}
      onConfirm={handleConfirm}
      title="Close Risk"
      variant="warning"
      confirmText={
        closeMutation.isPending
          ? "Closing..."
          : selectedStatus === "CLOSED"
            ? "Close Risk"
            : "Accept Risk"
      }
      isLoading={closeMutation.isPending}
      description={
        <div className="space-y-3">
          <p>
            You are about to resolve the risk:{" "}
            <span className="font-semibold text-zinc-200">
              &ldquo;{riskTitle}&rdquo;
            </span>
            .
          </p>

          {isHighRisk && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-800/60 bg-amber-950/40 p-3 text-xs text-amber-300">
              <ShieldCheck className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
              <span>
                <strong>High / Critical Risk (Score: {inherentScore}):</strong>{" "}
                Requires CISO or Tenant Admin authorization to complete sign-off.
              </span>
            </div>
          )}

          {!hasTreatmentPlan && (
            <div className="rounded-lg border border-rose-800/60 bg-rose-950/40 p-3 text-xs text-rose-300">
              <strong>Warning:</strong> This risk has no treatment plan defined.
              The backend requires an established treatment plan before closing.
            </div>
          )}
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Resolution Status
          </label>
          <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setSelectedStatus("CLOSED")}
              className={`flex items-start gap-3 rounded-lg border p-3 text-left transition cursor-pointer ${
                selectedStatus === "CLOSED"
                  ? "border-emerald-600 bg-emerald-950/30 text-zinc-100 ring-1 ring-emerald-500/50"
                  : "border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-zinc-700 hover:bg-zinc-900"
              }`}
            >
              <CheckCircle2
                className={`h-4 w-4 mt-0.5 shrink-0 ${
                  selectedStatus === "CLOSED"
                    ? "text-emerald-400"
                    : "text-zinc-500"
                }`}
              />
              <div>
                <div className="text-xs font-semibold text-zinc-200">
                  CLOSED
                </div>
                <div className="text-[11px] text-zinc-400 mt-0.5">
                  Mitigation executed & risk treated
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setSelectedStatus("ACCEPTED")}
              className={`flex items-start gap-3 rounded-lg border p-3 text-left transition cursor-pointer ${
                selectedStatus === "ACCEPTED"
                  ? "border-purple-600 bg-purple-950/30 text-zinc-100 ring-1 ring-purple-500/50"
                  : "border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-zinc-700 hover:bg-zinc-900"
              }`}
            >
              <CheckCircle2
                className={`h-4 w-4 mt-0.5 shrink-0 ${
                  selectedStatus === "ACCEPTED"
                    ? "text-purple-400"
                    : "text-zinc-500"
                }`}
              />
              <div>
                <div className="text-xs font-semibold text-zinc-200">
                  ACCEPTED
                </div>
                <div className="text-[11px] text-zinc-400 mt-0.5">
                  Residual risk accepted by organization
                </div>
              </div>
            </button>
          </div>
        </div>

        {mutationError && (
          <div className="rounded-lg border border-rose-800/80 bg-rose-950/60 p-3 text-xs text-rose-300">
            {mutationError}
          </div>
        )}
      </div>
    </ConfirmModal>
  );
}

export default RiskCloseModal;
