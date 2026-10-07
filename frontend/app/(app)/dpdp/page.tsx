"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth/context";
import { apiFetch } from "@/lib/api/client";
import { ForbiddenState } from "@/components/ForbiddenState";
import { ConfirmModal } from "@/components/ConfirmModal";
import {
  Clock,
  AlertOctagon,
  CheckCircle2,
  Loader2,
  Calendar,
  RotateCcw,
} from "lucide-react";

interface BreachClockData {
  status: "INACTIVE" | "ACTIVE" | "RESOLVED";
  started_at?: string | null;
  acknowledged_by?: string | null;
  notified_at?: string | null;
  deadline?: string | null;
  resolved_at?: string | null;
}

interface AssigneeItem {
  user_id: string;
  email: string;
}

export default function DpdpPage() {
  const { user, can } = useAuth();
  const [clock, setClock] = useState<BreachClockData | null>(null);
  const [assigneeMap, setAssigneeMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [isResolveModalOpen, setIsResolveModalOpen] = useState(false);

  const fetchClock = useCallback(async () => {
    try {
      const [res, assignees] = await Promise.all([
        apiFetch<BreachClockData>("/v1/dpdp/breach-clock"),
        apiFetch<AssigneeItem[]>("/v1/controls/assignees").catch(() => []),
      ]);
      setClock(res);

      const map: Record<string, string> = {};
      (assignees || []).forEach((a) => {
        map[a.user_id] = a.email;
      });
      setAssigneeMap(map);

      if (res.deadline) {
        const diff = new Date(res.deadline).getTime() - Date.now();
        setTimeRemaining(Math.max(0, diff));
      }
    } catch (err: any) {
      console.error("DPDP fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClock();
  }, [fetchClock]);

  // Live 1-second countdown
  useEffect(() => {
    if (clock?.status === "ACTIVE" && clock.deadline) {
      const interval = setInterval(() => {
        const diff = new Date(clock.deadline!).getTime() - Date.now();
        setTimeRemaining(Math.max(0, diff));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [clock]);

  const handleStart = async () => {
    setSubmitting(true);
    try {
      await apiFetch("/v1/dpdp/breach-clock/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      await fetchClock();
    } catch (err: any) {
      await fetchClock();
      if (!err.message?.toLowerCase().includes("already active")) {
        alert(err.message || "Failed to start breach clock.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleResolveConfirm = async () => {
    setSubmitting(true);
    try {
      await apiFetch("/v1/dpdp/breach-clock/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      setIsResolveModalOpen(false);
      await fetchClock();
    } catch (err: any) {
      alert(err.message || "Failed to resolve breach clock.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!can(["dpdp:read"])) {
    return <ForbiddenState message="You do not possess permission to view the DPDP Compliance Center." />;
  }

  if (loading) {
    return (
      <div className="p-16 flex items-center justify-center text-slate-400 gap-2">
        <Loader2 size={20} className="animate-spin text-brand-orange" />
        <span>Loading regulatory breach status...</span>
      </div>
    );
  }

  const hours = Math.floor(timeRemaining / (1000 * 60 * 60));
  const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((timeRemaining % (1000 * 60)) / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  const formattedCountdown = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;

  let timerBoxClass = "border-emerald-700/60 bg-emerald-950/20 text-emerald-400";
  let isCriticalAlert = false;

  if (hours < 6) {
    timerBoxClass = "border-rose-600 bg-rose-950/40 text-rose-400 animate-pulse";
    isCriticalAlert = true;
  } else if (hours < 24) {
    timerBoxClass = "border-rose-700/80 bg-rose-950/30 text-rose-400";
  } else if (hours <= 48) {
    timerBoxClass = "border-amber-600/80 bg-amber-950/30 text-amber-400 shadow-lg shadow-amber-950/30";
  }

  // Resolve UUID to email + fallback
  const acknowledgedEmail = clock?.acknowledged_by
    ? assigneeMap[clock.acknowledged_by] ||
      (clock.acknowledged_by === user?.userId ? `${user.email} (You)` : `${clock.acknowledged_by.slice(0, 8)}...`)
    : "Designated Officer";

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-mono font-semibold tracking-wider text-brand-orange uppercase">
          DATA PROTECTION & REGULATORY NOTIFICATION
        </p>
        <h1 className="text-2xl font-heading font-bold text-slate-100 mt-1">
          DPDP 72-Hour Breach Center
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Mandatory incident response tracking per CERT-In directions and the Digital Personal Data Protection Act 2023.
        </p>
      </div>

      {isCriticalAlert && clock?.status === "ACTIVE" && (
        <div className="p-4 bg-rose-950 border border-rose-600 rounded-2xl flex items-center gap-3 text-rose-200 text-xs font-semibold animate-bounce shadow-lg">
          <AlertOctagon size={18} className="text-rose-400 shrink-0" />
          <span>CRITICAL: Under 6 hours remaining to complete mandatory regulatory reporting!</span>
        </div>
      )}

      <section className="p-8 bg-surface border border-border rounded-2xl shadow-xl space-y-6">
        {/* INACTIVE State */}
        {clock?.status === "INACTIVE" && (
          <div className="flex flex-col items-center justify-center p-12 text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-surface-raised border border-border flex items-center justify-center text-slate-500">
              <Clock size={32} />
            </div>
            <div>
              <h2 className="text-xl font-heading font-semibold text-slate-100">
                No Active Breach Clock
              </h2>
              <p className="text-xs text-slate-400 mt-1 max-w-md leading-relaxed">
                The 72-hour regulatory notification clock is currently paused. No active data incident has been declared for this tenant.
              </p>
            </div>
            {can(["dpdp:write"]) && (
              <button
                type="button"
                onClick={handleStart}
                disabled={submitting}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs rounded-xl shadow-lg transition cursor-pointer disabled:opacity-50 flex items-center gap-2"
              >
                {submitting && <Loader2 size={14} className="animate-spin" />}
                <span>{submitting ? "Initiating..." : "Declare Breach Incident"}</span>
              </button>
            )}
          </div>
        )}

        {/* ACTIVE State */}
        {clock?.status === "ACTIVE" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-semibold uppercase text-rose-400 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
                ACTIVE 72-HOUR REGULATORY COUNTDOWN
              </span>
              {can(["dpdp:write"]) && (
                <button
                  type="button"
                  onClick={() => setIsResolveModalOpen(true)}
                  disabled={submitting}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white font-semibold text-xs rounded-xl shadow transition cursor-pointer disabled:opacity-50"
                >
                  Resolve Incident
                </button>
              )}
            </div>

            <div className={`p-8 rounded-2xl border flex flex-col items-center justify-center text-center transition-all ${timerBoxClass}`}>
              <span className="text-xs font-mono uppercase tracking-widest opacity-80 mb-2">
                Time Remaining to Regulatory Deadline
              </span>
              <div className="text-5xl md:text-7xl font-mono font-bold tracking-tight tabular-nums">
                {formattedCountdown}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-border text-xs">
              <div className="p-3.5 bg-surface-raised rounded-xl border border-border flex items-center gap-3">
                <Calendar size={18} className="text-brand-orange shrink-0" />
                <div>
                  <div className="text-slate-400 font-mono text-[10px]">INCIDENT STARTED</div>
                  <div className="text-slate-200 font-medium">
                    {clock.started_at ? new Date(clock.started_at).toLocaleString() : "—"}
                  </div>
                </div>
              </div>

              <div className="p-3.5 bg-surface-raised rounded-xl border border-border flex items-center gap-3">
                <Clock size={18} className="text-brand-orange shrink-0" />
                <div>
                  <div className="text-slate-400 font-mono text-[10px]">72-HOUR DEADLINE</div>
                  <div className="text-slate-200 font-medium">
                    {clock.deadline ? new Date(clock.deadline).toLocaleString() : "—"}
                  </div>
                </div>
              </div>

              {/* Resolved Email & Avatar Badge */}
              <div className="p-3.5 bg-surface-raised rounded-xl border border-border flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-surface border border-border flex items-center justify-center text-[10px] font-bold text-brand-orange shrink-0">
                  {acknowledgedEmail.slice(0, 2).toUpperCase()}
                </div>
                <div className="overflow-hidden">
                  <div className="text-slate-400 font-mono text-[10px]">ACKNOWLEDGED BY</div>
                  <div className="text-slate-200 font-medium truncate" title={clock.acknowledged_by || ""}>
                    {acknowledgedEmail}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* RESOLVED State */}
        {clock?.status === "RESOLVED" && (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-emerald-950/60 border border-emerald-700/60 flex items-center justify-center text-emerald-400 shrink-0">
                <CheckCircle2 size={24} />
              </div>
              <div>
                <h2 className="text-lg font-heading font-semibold text-slate-100">
                  Breach Incident Resolved
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  The regulatory response window has been satisfied and closed.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-surface-raised/60 rounded-xl border border-border text-xs">
              <div>
                <span className="text-slate-500 font-mono text-[10px] block">STARTED</span>
                <span className="text-slate-200 font-medium">
                  {clock.started_at ? new Date(clock.started_at).toLocaleString() : "—"}
                </span>
              </div>
              <div>
                <span className="text-slate-500 font-mono text-[10px] block">RESOLVED AT</span>
                <span className="text-emerald-400 font-medium">
                  {clock.resolved_at ? new Date(clock.resolved_at).toLocaleString() : "—"}
                </span>
              </div>
              <div>
                <span className="text-slate-500 font-mono text-[10px] block">ACKNOWLEDGED BY</span>
                <div className="flex items-center gap-2 mt-0.5">
                  <div className="w-5 h-5 rounded-full bg-surface border border-border flex items-center justify-center text-[9px] font-bold text-brand-orange shrink-0">
                    {acknowledgedEmail.slice(0, 2).toUpperCase()}
                  </div>
                  <span className="text-slate-200 font-medium truncate">{acknowledgedEmail}</span>
                </div>
              </div>
            </div>

            {can(["dpdp:write"]) && (
              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleStart}
                  className="px-4 py-2 bg-surface-raised border border-border hover:border-brand-orange text-xs text-slate-300 font-semibold rounded-xl transition cursor-pointer flex items-center gap-1.5"
                >
                  <RotateCcw size={13} />
                  <span>Initiate New Period</span>
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Resolve Confirmation Modal */}
      {isResolveModalOpen && (
        <ConfirmModal
          isOpen={true}
          title="Resolve DPDP Breach Incident"
          description="Are you sure you want to stop the 72-hour countdown? This will record the current timestamp as the incident resolution time and mark the breach clock as Resolved."
          confirmText="Confirm Resolution"
          variant="warning"
          isLoading={submitting}
          onConfirm={handleResolveConfirm}
          onClose={() => setIsResolveModalOpen(false)}
        />
      )}
    </div>
  );
}