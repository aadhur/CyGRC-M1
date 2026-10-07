"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth/context";
import { apiFetch } from "@/lib/api/client";
import { HTTP_ACTION_TAGS } from "@/lib/design/status";
import {
  ShieldCheck,
  Layers3,
  ArrowRight,
  ShieldAlert,
  Clock,
  ClipboardList,
} from "lucide-react";

interface ControlItem {
  control_id: string;
  status: string;
  framework_id: string;
}

interface FrameworkItem {
  framework_id: string;
  code: string;
}

interface RiskSummaryItem {
  risk_id: string;
  inherent_score: number;
  status: string;
}

interface BreachClockData {
  status: "INACTIVE" | "ACTIVE" | "RESOLVED";
  deadline?: string | null;
}

interface AuditSummaryItem {
  audit_id: string;
  status: string;
  scoped_control_count: number;
}

interface AuditLogEntry {
  log_id: string;
  action: string;
  target: string;
  created_at: string;
}

export default function DashboardPage() {
  const { can, user } = useAuth();

  const [controls, setControls] = useState<ControlItem[]>([]);
  const [frameworks, setFrameworks] = useState<FrameworkItem[]>([]);
  const [risks, setRisks] = useState<RiskSummaryItem[]>([]);
  const [breachClock, setBreachClock] = useState<BreachClockData | null>(null);
  const [audits, setAudits] = useState<AuditSummaryItem[]>([]);
  const [recentLogs, setRecentLogs] = useState<AuditLogEntry[]>([]);

  useEffect(() => {
    async function loadDashboard() {
      try {
        const promises = [];
        if (can(["controls:read"])) {
          promises.push(apiFetch<ControlItem[]>("/v1/controls").then(setControls).catch(() => []));
        }
        if (can(["frameworks:read"])) {
          promises.push(apiFetch<FrameworkItem[]>("/v1/frameworks").then(setFrameworks).catch(() => []));
        }
        if (can(["risks:read"])) {
          promises.push(apiFetch<RiskSummaryItem[]>("/v1/risks").then(setRisks).catch(() => []));
        }
        if (can(["dpdp:read"])) {
          promises.push(apiFetch<BreachClockData>("/v1/dpdp/breach-clock").then(setBreachClock).catch(() => null));
        }
        if (can(["audits:read"])) {
          promises.push(apiFetch<AuditSummaryItem[]>("/v1/audits").then(setAudits).catch(() => []));
        }
        if (can(["auditlog:read"])) {
          promises.push(
            apiFetch<{ audit_logs: AuditLogEntry[] }>("/v1/audit-log")
              .then((res) => setRecentLogs(res.audit_logs?.slice(0, 4) || []))
              .catch(() => [])
          );
        }
        await Promise.all(promises);
      } catch (err) {
        console.error("Dashboard error:", err);
      }
    }
    loadDashboard();
  }, [can]);

  const counts = useMemo(() => {
    const passing = controls.filter((c) => c.status === "PASSING").length;
    const inRemediation = controls.filter((c) => c.status === "IN_REMEDIATION").length;
    const stale = controls.filter((c) => c.status === "STALE").length;
    const failing = controls.filter((c) => c.status === "FAILING").length;
    const total = controls.length;
    const percent = total > 0 ? Math.round((passing / total) * 100) : 0;
    return { passing, inRemediation, stale, failing, total, percent };
  }, [controls]);

  const activeFrameworkCount = useMemo(() => {
    const activeIds = new Set(controls.map((c) => c.framework_id));
    return activeIds.size;
  }, [controls]);

  const highRisksCount = risks.filter((r) => r.inherent_score >= 16 && r.status !== "CLOSED").length;
  const openRisksCount = risks.filter((r) => r.status === "OPEN" || r.status === "TREATING").length;

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-mono font-semibold tracking-wider text-brand-orange uppercase">
          COMPLIANCE OPERATIONS
        </p>
        <h1 className="text-2xl font-heading font-bold text-slate-100 mt-1">
          Welcome, {user?.email?.split("@")[0] || "Operator"}.
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Real-time compliance posture, active audits, and risk posture.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Controls Health */}
        {can(["controls:read"]) && (
          <section className="md:col-span-2 p-6 bg-surface border border-border rounded-2xl shadow-lg flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">
                    CONTROL HEALTH
                  </span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-3xl font-heading font-bold text-slate-100">
                      {counts.percent}%
                    </span>
                    <span className="text-xs text-slate-400">
                      ({counts.passing}/{counts.total} passing)
                    </span>
                  </div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-emerald-950/50 border border-emerald-700/50 flex items-center justify-center text-emerald-400">
                  <ShieldCheck size={20} />
                </div>
              </div>

              <div className="w-full bg-surface-raised h-2.5 rounded-full overflow-hidden mb-6 flex">
                <div
                  className="bg-emerald-500 h-full transition-all duration-500"
                  style={{ width: `${counts.total ? (counts.passing / counts.total) * 100 : 0}%` }}
                />
                <div
                  className="bg-sky-500 h-full transition-all duration-500"
                  style={{ width: `${counts.total ? (counts.inRemediation / counts.total) * 100 : 0}%` }}
                />
                <div
                  className="bg-amber-500 h-full transition-all duration-500"
                  style={{ width: `${counts.total ? (counts.stale / counts.total) * 100 : 0}%` }}
                />
                <div
                  className="bg-rose-500 h-full transition-all duration-500"
                  style={{ width: `${counts.total ? (counts.failing / counts.total) * 100 : 0}%` }}
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-border text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                  <span className="text-slate-300">{counts.passing} Passing</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-sky-400 shrink-0" />
                  <span className="text-slate-300">{counts.inRemediation} In Remediation</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                  <span className="text-slate-300">{counts.stale} Stale</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-rose-400 shrink-0" />
                  <span className="text-slate-300">{counts.failing} Failing</span>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Frameworks Enabled */}
        {can(["frameworks:read"]) && (
          <section className="p-6 bg-surface border border-border rounded-2xl shadow-lg flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-brand-orange/15 border border-brand-orange/40 flex items-center justify-center text-brand-orange mb-4">
                <Layers3 size={20} />
              </div>
              <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">
                FRAMEWORKS ENABLED
              </span>
              <div className="text-3xl font-heading font-bold text-slate-100 mt-1">
                {activeFrameworkCount}
              </div>
              <p className="text-xs text-slate-400 mt-2">
                {activeFrameworkCount} active in workspace ({frameworks.length - activeFrameworkCount} in catalog).
              </p>
            </div>
            <Link
              href="/frameworks"
              className="mt-6 flex items-center gap-1.5 text-xs text-brand-orange font-semibold hover:underline"
            >
              <span>View catalog</span>
              <ArrowRight size={13} />
            </Link>
          </section>
        )}

        {/* Live Risk Posture */}
        {can(["risks:read"]) && (
          <section className="p-6 bg-surface border border-border rounded-2xl shadow-lg flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-rose-950/50 border border-rose-700/50 flex items-center justify-center text-rose-400 mb-4">
                <ShieldAlert size={20} />
              </div>
              <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">
                RISK POSTURE
              </span>
              <div className="text-3xl font-heading font-bold text-slate-100 mt-1">
                {openRisksCount}
              </div>
              <div className="flex items-center gap-2 mt-2 text-xs">
                {highRisksCount > 0 ? (
                  <span className="px-2 py-0.5 rounded bg-rose-950/60 text-rose-400 border border-rose-800 font-mono">
                    {highRisksCount} High / Critical (Score ≥ 16)
                  </span>
                ) : (
                  <span className="text-emerald-400 font-mono">No critical risks</span>
                )}
              </div>
            </div>
            <Link
              href="/risks"
              className="mt-6 flex items-center gap-1.5 text-xs text-brand-orange font-semibold hover:underline"
            >
              <span>Open risk register</span>
              <ArrowRight size={13} />
            </Link>
          </section>
        )}

        {/* DPDP 72-Hour Clock Status */}
        {can(["dpdp:read"]) && (
          <section className="p-6 bg-surface border border-border rounded-2xl shadow-lg flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-surface-raised border border-border flex items-center justify-center text-slate-300 mb-4">
                <Clock size={20} />
              </div>
              <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">
                72-HR BREACH CLOCK
              </span>
              <div className="text-xl font-heading font-bold text-slate-100 mt-1 flex items-center gap-2">
                {breachClock?.status === "ACTIVE" ? (
                  <span className="text-rose-400 font-mono flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
                    ACTIVE INCIDENT
                  </span>
                ) : breachClock?.status === "RESOLVED" ? (
                  <span className="text-emerald-400">Resolved</span>
                ) : (
                  <span className="text-slate-400">Inactive</span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-2">
                Regulatory notification response tracker per DPDP 2023.
              </p>
            </div>
            <Link
              href="/dpdp"
              className="mt-6 flex items-center gap-1.5 text-xs text-brand-orange font-semibold hover:underline"
            >
              <span>Compliance center</span>
              <ArrowRight size={13} />
            </Link>
          </section>
        )}

        {/* Audit Assessment Cycles */}
        {can(["audits:read"]) && (
          <section className="p-6 bg-surface border border-border rounded-2xl shadow-lg flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-surface-raised border border-border flex items-center justify-center text-slate-300 mb-4">
                <ClipboardList size={20} />
              </div>
              <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">
                AUDIT CYCLES
              </span>
              <div className="text-3xl font-heading font-bold text-slate-100 mt-1">
                {audits.length}
              </div>
              <p className="text-xs text-slate-400 mt-2">
                {audits.filter((a) => a.status !== "CLOSED").length} currently in assessment.
              </p>
            </div>
            <Link
              href="/audits"
              className="mt-6 flex items-center gap-1.5 text-xs text-brand-orange font-semibold hover:underline"
            >
              <span>View audits</span>
              <ArrowRight size={13} />
            </Link>
          </section>
        )}

        {/* Recent Audit Operations */}
        {can(["auditlog:read"]) && (
          <section className="md:col-span-3 p-6 bg-surface border border-border rounded-2xl shadow-lg space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">
                  SYSTEM ACTIVITY
                </span>
                <h3 className="text-base font-heading font-semibold text-slate-100">
                  Recent Audit Operations
                </h3>
              </div>
              <Link
                href="/audit-log"
                className="flex items-center gap-1 text-xs text-brand-orange font-semibold hover:underline"
              >
                <span>View full log</span>
                <ArrowRight size={13} />
              </Link>
            </div>

            <div className="divide-y divide-border border-t border-border pt-2">
              {recentLogs.map((log) => (
                <div key={log.log_id} className="py-2.5 flex items-center justify-between text-xs font-mono">
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${HTTP_ACTION_TAGS[log.action] || "bg-slate-800 text-slate-300"}`}>
                      {log.action}
                    </span>
                    <span className="text-slate-300">{log.target}</span>
                  </div>
                  <span className="text-slate-500">{new Date(log.created_at).toLocaleTimeString()}</span>
                </div>
              ))}
              {recentLogs.length === 0 && (
                <div className="text-xs text-slate-500 py-3 text-center">No recent audit log activity.</div>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}