"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Loader2, X } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";

import { api, ApiError } from "@/lib/api/client";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { QueryError } from "@/components/QueryError";

interface Framework {
  framework_id: string;
  name: string;
  code: string;
}

interface Control {
  control_id: string;
  code: string;
  title: string;
  framework_id: string;
}

interface NewAuditModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}

export default function NewAuditModal({
  open,
  onClose,
  onSuccess,
}: NewAuditModalProps) {
  const [frameworkId, setFrameworkId] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [selectedControls, setSelectedControls] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  const frameworksQuery = useQuery({
    queryKey: ["audit-frameworks"],
    queryFn: () => api.get<Framework[]>("/v1/frameworks"),
    enabled: open,
  });

  const controlsQuery = useQuery({
    queryKey: ["audit-controls"],
    queryFn: () => api.get<Control[]>("/v1/controls"),
    enabled: open && Boolean(frameworkId),
  });

  const controls = (controlsQuery.data ?? []).filter(
    (control) => control.framework_id === frameworkId
  );

  const createMutation = useMutation({
    mutationFn: () =>
      api.post("/v1/audits", {
        framework_id: frameworkId,
        period_start: periodStart,
        period_end: periodEnd,
        control_ids: selectedControls,
      }),
    onSuccess: () => {
      onSuccess();
      handleClose();
    },
    onError: (error) => {
      setFormError(
        getErrorMessage(error, "Failed to create audit cycle.")
      );
    },
  });

  useEffect(() => {
    setSelectedControls([]);
    setFormError(null);
  }, [frameworkId]);

  function toggleControl(id: string) {
    setSelectedControls((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id]
    );
  }

  function toggleAll() {
    if (selectedControls.length === controls.length) {
      setSelectedControls([]);
      return;
    }

    setSelectedControls(controls.map((control) => control.control_id));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    if (!frameworkId || !periodStart || !periodEnd) {
      setFormError(
        "Framework, start date, and end date are required."
      );
      return;
    }

    if (periodEnd < periodStart) {
      setFormError("Period end must be on or after period start.");
      return;
    }

    if (selectedControls.length === 0) {
      setFormError("Select at least one control.");
      return;
    }

    createMutation.mutate();
  }

  function handleClose() {
    if (createMutation.isPending) return;

    setFrameworkId("");
    setPeriodStart("");
    setPeriodEnd("");
    setSelectedControls([]);
    setFormError(null);
    onClose();
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-audit-title"
    >
      <div className="w-full max-w-2xl rounded-2xl border border-border bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2
              id="new-audit-title"
              className="text-base font-semibold text-slate-100"
            >
              Start Audit Cycle
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">
              Select a framework, define the assessment period, and scope controls.
            </p>
          </div>

          <button
            type="button"
            onClick={handleClose}
            disabled={createMutation.isPending}
            aria-label="Close modal"
            className="rounded-lg p-1.5 text-slate-500 transition hover:bg-surface-raised hover:text-slate-200 disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 px-6 py-5">
          <div>
            <label
              htmlFor="audit-framework"
              className="mb-1.5 block text-xs font-medium text-slate-400"
            >
              Framework <span className="text-rose-400">*</span>
            </label>

            {frameworksQuery.isLoading ? (
              <LoadingSkeleton rows={1} className="[&>div]:h-10" />
            ) : frameworksQuery.isError ? (
              <QueryError
                message={getErrorMessage(
                  frameworksQuery.error,
                  "Unable to load frameworks."
                )}
                onRetry={() => frameworksQuery.refetch()}
                isRetrying={frameworksQuery.isFetching}
              />
            ) : (
              <select
                id="audit-framework"
                value={frameworkId}
                onChange={(event) => setFrameworkId(event.target.value)}
                required
                className="w-full rounded-xl border border-border bg-surface-raised px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-orange/50"
              >
                <option value="">Select a framework...</option>
                {frameworksQuery.data?.map((framework) => (
                  <option
                    key={framework.framework_id}
                    value={framework.framework_id}
                  >
                    {framework.code} — {framework.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="audit-period-start"
                className="mb-1.5 block text-xs font-medium text-slate-400"
              >
                Period Start <span className="text-rose-400">*</span>
              </label>

              <input
                id="audit-period-start"
                type="date"
                value={periodStart}
                onChange={(event) => setPeriodStart(event.target.value)}
                required
                className="w-full rounded-xl border border-border bg-surface-raised px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-orange/50"
              />
            </div>

            <div>
              <label
                htmlFor="audit-period-end"
                className="mb-1.5 block text-xs font-medium text-slate-400"
              >
                Period End <span className="text-rose-400">*</span>
              </label>

              <input
                id="audit-period-end"
                type="date"
                min={periodStart || undefined}
                value={periodEnd}
                onChange={(event) => setPeriodEnd(event.target.value)}
                required
                className="w-full rounded-xl border border-border bg-surface-raised px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-orange/50"
              />
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-xs font-medium text-slate-400">
                Scoped Controls <span className="text-rose-400">*</span>
              </label>

              {controls.length > 0 && (
                <button
                  type="button"
                  onClick={toggleAll}
                  className="text-xs font-medium text-brand-orange hover:underline"
                >
                  {selectedControls.length === controls.length
                    ? "Deselect all"
                    : "Select all"}
                </button>
              )}
            </div>

            <div className="max-h-56 overflow-y-auto rounded-xl border border-border bg-surface-raised">
              {!frameworkId ? (
                <p className="px-4 py-8 text-center text-xs text-slate-500">
                  Select a framework to load controls.
                </p>
              ) : controlsQuery.isLoading ? (
                <div className="p-4">
                  <LoadingSkeleton rows={4} />
                </div>
              ) : controlsQuery.isError ? (
                <QueryError
                  message={getErrorMessage(
                    controlsQuery.error,
                    "Unable to load controls."
                  )}
                  onRetry={() => controlsQuery.refetch()}
                  isRetrying={controlsQuery.isFetching}
                />
              ) : controls.length === 0 ? (
                <p className="px-4 py-8 text-center text-xs text-slate-500">
                  No controls found for this framework.
                </p>
              ) : (
                <div className="divide-y divide-border">
                  {controls.map((control) => (
                    <label
                      key={control.control_id}
                      className="flex cursor-pointer items-start gap-3 px-4 py-3 transition hover:bg-surface"
                    >
                      <input
                        type="checkbox"
                        checked={selectedControls.includes(
                          control.control_id
                        )}
                        onChange={() =>
                          toggleControl(control.control_id)
                        }
                        className="mt-0.5 accent-brand-orange"
                      />

                      <span className="text-xs">
                        <span className="font-mono font-medium text-brand-orange">
                          {control.code}
                        </span>
                        <span className="ml-2 text-slate-300">
                          {control.title}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {selectedControls.length > 0 && (
              <p className="mt-1 text-xs text-slate-500">
                {selectedControls.length} of {controls.length} selected
              </p>
            )}
          </div>

          {formError && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-800/60 bg-rose-950/40 px-3 py-2.5 text-xs text-rose-400">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
            <button
              type="button"
              onClick={handleClose}
              disabled={createMutation.isPending}
              className="rounded-xl px-4 py-2 text-sm text-slate-400 transition hover:bg-surface-raised hover:text-slate-200 disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={createMutation.isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-orange px-4 py-2 text-sm font-semibold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {createMutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              {createMutation.isPending
                ? "Creating..."
                : "Start Audit Cycle"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}