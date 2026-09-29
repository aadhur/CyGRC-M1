"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  Calendar,
  Check,
  CheckCircle,
  Copy,
  Edit3,
  Lock,
  RotateCcw,
  Save,
  Shield,
  ShieldAlert,
  Zap,
} from "lucide-react";

import { useAuth } from "@/lib/auth/context";
import { apiFetch } from "@/lib/api/client";
import {
  getScoreBadge,
  RISK_STATUS_STYLES,
  RISK_TREATMENT_STYLES,
} from "@/lib/design/status";
import { cn } from "@/lib/utils";
import RiskCloseModal from "./RiskCloseModal";

export type RiskTreatment = "AVOID" | "MITIGATE" | "TRANSFER" | "ACCEPT";
export type RiskStatus = "OPEN" | "TREATING" | "CLOSED" | "ACCEPTED";

export interface Risk {
  risk_id: string;
  title: string;
  description: string | null;
  likelihood: number;
  impact: number;
  inherent_score: number;
  residual_score: number | null;
  treatment: RiskTreatment | null;
  treatment_plan: string | null;
  target_close_date: string | null;
  status: RiskStatus;
  control_ids: string[];
}

interface RiskDetailProps {
  risk: Risk;
  onRefresh?: () => void;
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
  if (!err) return "An unexpected error occurred.";
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

  return msg || "Failed to update risk.";
}

export function RiskDetail({ risk, onRefresh }: RiskDetailProps) {
  const { user, can } = useAuth();
  const queryClient = useQueryClient();

  const [copiedId, setCopiedId] = useState(false);
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
  const [patchError, setPatchError] = useState<string | null>(null);

  // Form state for editable treatment plan & metadata
  const [treatment, setTreatment] = useState<RiskTreatment>(
    risk.treatment || "MITIGATE",
  );
  const [treatmentPlan, setTreatmentPlan] = useState<string>(
    risk.treatment_plan || "",
  );
  const [likelihood, setLikelihood] = useState<number>(risk.likelihood);
  const [impact, setImpact] = useState<number>(risk.impact);
  const [status, setStatus] = useState<"OPEN" | "TREATING">(
    risk.status === "TREATING" ? "TREATING" : "OPEN",
  );
  const [targetCloseDate, setTargetCloseDate] = useState<string>(
    risk.target_close_date
      ? new Date(risk.target_close_date).toISOString().slice(0, 10)
      : "",
  );

  // Sync state whenever server data refreshes
  useEffect(() => {
    setTreatment(risk.treatment || "MITIGATE");
    setTreatmentPlan(risk.treatment_plan || "");
    setLikelihood(risk.likelihood);
    setImpact(risk.impact);
    setStatus(risk.status === "TREATING" ? "TREATING" : "OPEN");
    setTargetCloseDate(
      risk.target_close_date
        ? new Date(risk.target_close_date).toISOString().slice(0, 10)
        : "",
    );
  }, [risk]);

  // Compute hasChanges to enable/disable Save button
  const hasChanges = useMemo(() => {
    const origDate = risk.target_close_date
      ? new Date(risk.target_close_date).toISOString().slice(0, 10)
      : "";
    return (
      (risk.treatment || "MITIGATE") !== treatment ||
      (risk.treatment_plan || "") !== treatmentPlan ||
      risk.likelihood !== likelihood ||
      risk.impact !== impact ||
      (risk.status === "TREATING" ? "TREATING" : "OPEN") !== status ||
      origDate !== targetCloseDate
    );
  }, [
    risk,
    treatment,
    treatmentPlan,
    likelihood,
    impact,
    status,
    targetCloseDate,
  ]);

  const liveInherentScore = likelihood * impact;
  const currentScoreBadge = getScoreBadge(risk.inherent_score);
  const liveScoreBadge = getScoreBadge(liveInherentScore);

  // Permissions & Role Gate:
  // Inherent Score >= 16 requires CISO or TENANT_ADMIN role
  const hasCisoRole =
    user?.roles?.some((r) =>
      ["CISO", "TENANT_ADMIN"].includes(r.toUpperCase()),
    ) ?? false;

  const isClosedOrAccepted =
    risk.status === "CLOSED" || risk.status === "ACCEPTED";
  const closeGateBlocked = risk.inherent_score >= 16 && !hasCisoRole;
  const canCloseRisk = can(["risks:close"]);
  const isCloseDisabled = !canCloseRisk || closeGateBlocked || isClosedOrAccepted;

  const closeTooltip = closeGateBlocked
    ? "Score ≥ 16 requires CISO sign-off."
    : isClosedOrAccepted
      ? `Risk is already ${risk.status.toLowerCase()}.`
      : !canCloseRisk
        ? "You do not possess the required risks:close permission."
        : undefined;

  // PATCH Mutation
  const patchMutation = useMutation({
    mutationFn: async () => {
      setPatchError(null);
      const payload: Record<string, unknown> = {
        treatment,
        treatment_plan: treatmentPlan,
        likelihood,
        impact,
        status,
        target_close_date: targetCloseDate
          ? new Date(targetCloseDate).toISOString()
          : null,
      };

      return apiFetch(`/v1/risks/${risk.risk_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      toast.success("Risk changes saved successfully.");
      queryClient.invalidateQueries({ queryKey: ["risk", risk.risk_id] });
      queryClient.invalidateQueries({ queryKey: ["risks"] });
      onRefresh?.();
    },
    onError: (err: unknown) => {
      const sanitized = sanitizeErrorMessage(err);
      setPatchError(sanitized);
      toast.error(sanitized);
    },
  });

  const handleReset = () => {
    setTreatment(risk.treatment || "MITIGATE");
    setTreatmentPlan(risk.treatment_plan || "");
    setLikelihood(risk.likelihood);
    setImpact(risk.impact);
    setStatus(risk.status === "TREATING" ? "TREATING" : "OPEN");
    setTargetCloseDate(
      risk.target_close_date
        ? new Date(risk.target_close_date).toISOString().slice(0, 10)
        : "",
    );
    setPatchError(null);
  };

  const handleCopyId = () => {
    navigator.clipboard.writeText(risk.risk_id);
    setCopiedId(true);
    toast.success("Risk ID copied to clipboard");
    setTimeout(() => setCopiedId(false), 2000);
  };

  const formattedTargetDate = risk.target_close_date
    ? new Date(risk.target_close_date).toISOString().slice(0, 10)
    : "—";

  return (
    <div className="space-y-6">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center justify-between">
        <Link
          href="/risks"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Risk Register
        </Link>
      </div>

      {/* Top Metadata Bar / Header Card */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-6 shadow-sm backdrop-blur-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-mono text-zinc-500 uppercase tracking-wider">
                Risk ID:
              </span>
              <button
                type="button"
                onClick={handleCopyId}
                title="Click to copy Risk ID"
                className="group inline-flex items-center gap-1.5 rounded bg-zinc-900 px-2 py-0.5 text-xs font-mono text-zinc-400 hover:text-zinc-200 border border-zinc-800 hover:border-zinc-700 transition cursor-pointer"
              >
                <span>{risk.risk_id}</span>
                {copiedId ? (
                  <Check className="h-3 w-3 text-emerald-400" />
                ) : (
                  <Copy className="h-3 w-3 text-zinc-500 group-hover:text-zinc-300" />
                )}
              </button>
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-zinc-100 sm:text-3xl">
              {risk.title}
            </h1>

            {/* Badges Bar */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {/* Inherent Score Badge */}
              <span
                className={cn(
                  "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide",
                  currentScoreBadge.className,
                )}
              >
                Score {risk.inherent_score} — {currentScoreBadge.label}
              </span>

              {/* Status Pill */}
              <span
                className={cn(
                  "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium uppercase tracking-wide",
                  RISK_STATUS_STYLES[risk.status] ||
                    "bg-zinc-800 text-zinc-300 border border-zinc-700",
                )}
              >
                {risk.status}
              </span>

              {/* Treatment Strategy Badge */}
              {risk.treatment && (
                <span
                  className={cn(
                    "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium tracking-wide",
                    RISK_TREATMENT_STYLES[risk.treatment] ||
                      "bg-zinc-800 text-zinc-300 border border-zinc-700",
                  )}
                >
                  Treatment: {risk.treatment}
                </span>
              )}

              {/* Residual Score */}
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-900 border border-zinc-800 text-zinc-400">
                Residual: {risk.residual_score !== null ? risk.residual_score : "—"}
              </span>

              {/* Target Close Date */}
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-900 border border-zinc-800 text-zinc-400">
                <Calendar className="h-3 w-3 text-zinc-500" />
                Target: {formattedTargetDate}
              </span>
            </div>
          </div>

          {/* Top Actions: Close Risk Button */}
          <div className="flex items-center gap-3 pt-2 lg:pt-0">
            {canCloseRisk && (
              <div className="relative group/btn">
                <button
                  type="button"
                  disabled={isCloseDisabled}
                  title={closeTooltip}
                  onClick={() => setIsCloseModalOpen(true)}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold shadow-sm transition",
                    isCloseDisabled
                      ? "bg-zinc-800/60 text-zinc-500 border border-zinc-800 cursor-not-allowed opacity-60"
                      : "bg-rose-950/70 text-rose-300 border border-rose-800/80 hover:bg-rose-900/80 hover:text-white cursor-pointer active:scale-98",
                  )}
                >
                  <ShieldAlert className="h-4 w-4" />
                  Close Risk
                </button>

                {/* Floating tooltip explaining disabled state */}
                {closeTooltip && (
                  <div className="pointer-events-none absolute right-0 top-full mt-2 hidden w-64 rounded-md border border-zinc-800 bg-zinc-900 p-2 text-xs text-zinc-300 shadow-xl group-hover/btn:block z-20">
                    {closeTooltip}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Grid: Overview & Scoring Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Description & Linked Controls */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description Card */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-5 shadow-sm">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
              <Shield className="h-4 w-4 text-emerald-500" />
              Risk Description & Context
            </h3>
            <p className="mt-3 text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">
              {risk.description || (
                <span className="italic text-zinc-500">
                  No detailed description provided for this risk item.
                </span>
              )}
            </p>
          </div>

          {/* Linked Controls Card */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                <Shield className="h-4 w-4 text-blue-400" />
                Linked Security Controls ({risk.control_ids.length})
              </h3>
            </div>

            {risk.control_ids.length === 0 ? (
              <p className="mt-3 text-xs text-zinc-500 italic">
                No controls are currently linked to this risk. Controls can be
                associated during risk creation or mapped via the controls catalog.
              </p>
            ) : (
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {risk.control_ids.map((ctrlId) => (
                  <div
                    key={ctrlId}
                    className="flex items-center gap-2 rounded-lg border border-zinc-800/80 bg-zinc-900/60 px-3 py-2 text-xs font-mono text-zinc-300"
                  >
                    <CheckCircle className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                    <span className="truncate">{ctrlId}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Scoring Assessment Card */}
        <div className="space-y-6">
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-400" />
              Inherent Risk Scoring
            </h3>

            {/* Score Display Box */}
            <div
              className={cn(
                "rounded-lg p-4 border text-center transition-all",
                currentScoreBadge.className,
              )}
            >
              <div className="text-3xl font-extrabold tracking-tight">
                {risk.inherent_score}
              </div>
              <div className="text-xs font-medium uppercase tracking-wider mt-1">
                {currentScoreBadge.label} Risk
              </div>
              <div className="text-[11px] opacity-80 mt-1">
                Likelihood ({risk.likelihood}) × Impact ({risk.impact})
              </div>
            </div>

            {/* Metrics Breakdown */}
            <div className="space-y-3 pt-2">
              <div>
                <div className="flex justify-between text-xs text-zinc-400 mb-1">
                  <span>Likelihood</span>
                  <span className="font-semibold text-zinc-200">
                    {risk.likelihood} / 5
                  </span>
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {[1, 2, 3, 4, 5].map((val) => (
                    <div
                      key={val}
                      className={cn(
                        "h-2 rounded-sm transition-colors",
                        val <= risk.likelihood
                          ? "bg-amber-500"
                          : "bg-zinc-800",
                      )}
                    />
                  ))}
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs text-zinc-400 mb-1">
                  <span>Impact</span>
                  <span className="font-semibold text-zinc-200">
                    {risk.impact} / 5
                  </span>
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {[1, 2, 3, 4, 5].map((val) => (
                    <div
                      key={val}
                      className={cn(
                        "h-2 rounded-sm transition-colors",
                        val <= risk.impact ? "bg-rose-500" : "bg-zinc-800",
                      )}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Sign-off Rule Notice */}
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 text-[11px] text-zinc-400 leading-normal">
              <strong>Policy Standard:</strong> Risks with Inherent Score ≥ 16
              require explicit <em>CISO</em> or <em>Tenant Admin</em> sign-off to
              close.
            </div>
          </div>
        </div>
      </div>

      {/* Editable Treatment Panel (Gated by risks:write) */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-6 shadow-md backdrop-blur-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-zinc-800/80 pb-4 gap-3">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-zinc-100 flex items-center gap-2">
              <Edit3 className="h-5 w-5 text-emerald-400" />
              Treatment Plan & Remediation
            </h2>
            <p className="text-xs text-zinc-400 mt-1">
              {can(["risks:write"])
                ? "Update the treatment strategy, ratings, target date, and remediation plan."
                : "View current mitigation roadmap and scheduled remediation plan."}
            </p>
          </div>

          {!can(["risks:write"]) && (
            <div className="inline-flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900/90 px-3 py-1 text-xs text-zinc-400">
              <Lock className="h-3 w-3 text-zinc-500" />
              Read-only mode
            </div>
          )}
        </div>

        {patchError && (
          <div className="mt-4 rounded-lg border border-rose-800/80 bg-rose-950/60 p-3 text-xs text-rose-300">
            {patchError}
          </div>
        )}

        {/* Read-Only Presentation Mode */}
        {!can(["risks:write"]) ? (
          <div className="mt-6 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-lg border border-zinc-800/80 bg-zinc-900/50 p-4">
                <span className="text-xs text-zinc-500 uppercase tracking-wider">
                  Treatment Strategy
                </span>
                <div className="mt-1 text-sm font-semibold text-zinc-200">
                  {risk.treatment || "Not Assigned"}
                </div>
              </div>

              <div className="rounded-lg border border-zinc-800/80 bg-zinc-900/50 p-4">
                <span className="text-xs text-zinc-500 uppercase tracking-wider">
                  Lifecycle Status
                </span>
                <div className="mt-1 text-sm font-semibold text-zinc-200">
                  {risk.status}
                </div>
              </div>

              <div className="rounded-lg border border-zinc-800/80 bg-zinc-900/50 p-4">
                <span className="text-xs text-zinc-500 uppercase tracking-wider">
                  Target Close Date
                </span>
                <div className="mt-1 text-sm font-semibold text-zinc-200 flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 text-zinc-400" />
                  {formattedTargetDate}
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-zinc-800/80 bg-zinc-900/50 p-4">
              <span className="text-xs text-zinc-500 uppercase tracking-wider">
                Documented Treatment Plan
              </span>
              <p className="mt-2 text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">
                {risk.treatment_plan || (
                  <span className="italic text-zinc-500">
                    No treatment plan has been documented for this risk item.
                  </span>
                )}
              </p>
            </div>
          </div>
        ) : (
          /* Editable Form Mode */
          <form
            onSubmit={(e) => {
              e.preventDefault();
              patchMutation.mutate();
            }}
            className="mt-6 space-y-6"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Treatment Strategy Select */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                  Treatment
                </label>
                <select
                  value={treatment}
                  onChange={(e) => setTreatment(e.target.value as RiskTreatment)}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                >
                  <option value="MITIGATE">MITIGATE</option>
                  <option value="AVOID">AVOID</option>
                  <option value="TRANSFER">TRANSFER</option>
                  <option value="ACCEPT">ACCEPT</option>
                </select>
              </div>

              {/* Status Select (OPEN or TREATING) */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                  Status
                </label>
                <select
                  value={status}
                  onChange={(e) =>
                    setStatus(e.target.value as "OPEN" | "TREATING")
                  }
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                >
                  <option value="OPEN">OPEN</option>
                  <option value="TREATING">TREATING</option>
                </select>
              </div>

              {/* Likelihood Slider/Input */}
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <label className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                    Likelihood (1–5)
                  </label>
                  <span className="text-xs font-mono font-bold text-amber-400">
                    {likelihood}
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={5}
                  value={likelihood}
                  onChange={(e) => setLikelihood(Number(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>

              {/* Impact Slider/Input */}
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <label className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                    Impact (1–5)
                  </label>
                  <span className="text-xs font-mono font-bold text-rose-400">
                    {impact}
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={5}
                  value={impact}
                  onChange={(e) => setImpact(Number(e.target.value))}
                  className="w-full accent-rose-500 cursor-pointer"
                />
              </div>
            </div>

            {/* Target Close Date & Inherent Score Live Calculation preview */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                  Target Close Date
                </label>
                <input
                  type="date"
                  value={targetCloseDate}
                  onChange={(e) => setTargetCloseDate(e.target.value)}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                />
              </div>

              {/* Live Preview Score Indicator */}
              <div className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 px-4 py-2 flex items-center justify-between">
                <div>
                  <span className="text-xs text-zinc-400">
                    Projected Inherent Score:
                  </span>
                  <div className="text-xs font-mono text-zinc-300 mt-0.5">
                    {likelihood} × {impact} ={" "}
                    <strong className="text-zinc-100">
                      {liveInherentScore}
                    </strong>
                  </div>
                </div>
                <span
                  className={cn(
                    "px-2.5 py-0.5 rounded-full text-xs font-semibold",
                    liveScoreBadge.className,
                  )}
                >
                  {liveScoreBadge.label}
                </span>
              </div>
            </div>

            {/* Treatment Plan Textarea */}
            <div className="space-y-1.5">
              <div className="flex justify-between">
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                  Treatment Plan
                </label>
                <span className="text-[11px] text-zinc-500">
                  {treatmentPlan.length} characters
                </span>
              </div>
              <textarea
                rows={5}
                required
                value={treatmentPlan}
                onChange={(e) => setTreatmentPlan(e.target.value)}
                placeholder="Detail technical remediation controls, key actions, milestone dates, and mitigation deliverables..."
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 p-3 text-sm text-zinc-100 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono text-xs leading-relaxed"
              />
            </div>

            {/* Form Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={!hasChanges || patchMutation.isPending}
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition disabled:opacity-40 cursor-pointer"
              >
                <RotateCcw className="h-4 w-4" />
                Reset
              </button>

              <button
                type="submit"
                disabled={!hasChanges || patchMutation.isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 transition disabled:opacity-50 cursor-pointer active:scale-98"
              >
                {patchMutation.isPending ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Saving Changes...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Close Risk Modal */}
      {isCloseModalOpen && (
        <RiskCloseModal
          isOpen={isCloseModalOpen}
          onClose={() => setIsCloseModalOpen(false)}
          riskId={risk.risk_id}
          riskTitle={risk.title}
          inherentScore={risk.inherent_score}
          hasTreatmentPlan={Boolean(risk.treatment_plan?.trim())}
          onSuccess={() => {
            setIsCloseModalOpen(false);
            onRefresh?.();
          }}
        />
      )}
    </div>
  );
}

export default RiskDetail;
