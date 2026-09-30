"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth/context";
import { apiFetch } from "@/lib/api/client";
import { ComingSoon } from "@/components/ComingSoon";
import {
  ShieldCheck,
  Layers3,
  ArrowRight,
  Zap,
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

export default function DashboardPage() {
  const { can, user } = useAuth();
  const [controls, setControls] = useState<ControlItem[]>([]);
  const [frameworks, setFrameworks] = useState<FrameworkItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const promises = [];
        if (can(["controls:read"])) {
          promises.push(apiFetch<ControlItem[]>("/v1/controls").then(setControls));
        }
        if (can(["frameworks:read"])) {
          promises.push(apiFetch<FrameworkItem[]>("/v1/frameworks").then(setFrameworks));
        }
        await Promise.all(promises);
      } catch (err) {
        console.error("Dashboard data load error:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [can]);

  // Compute all control statuses per F8 specification
  const counts = useMemo(() => {
    const passing = controls.filter((c) => c.status === "PASSING").length;
    const inRemediation = controls.filter((c) => c.status === "IN_REMEDIATION").length;
    const stale = controls.filter((c) => c.status === "STALE").length;
    const failing = controls.filter((c) => c.status === "FAILING").length;
    const notAssessed = controls.filter((c) => c.status === "NOT_ASSESSED").length;
    const total = controls.length;
    const percent = total > 0 ? Math.round((passing / total) * 100) : 0;

    return { passing, inRemediation, stale, failing, notAssessed, total, percent };
  }, [controls]);

  // Count frameworks that actually have controls in this workspace
  const activeFrameworkCount = useMemo(() => {
    const activeIds = new Set(controls.map((c) => c.framework_id));
    return activeIds.size;
  }, [controls]);

  return (
    <div className="space-y-8">
      {/* Intro Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-mono font-semibold tracking-wider text-brand-orange uppercase">
            COMPLIANCE OPERATIONS
          </p>
          <h1 className="text-2xl font-heading font-bold text-slate-100 mt-1">
            Welcome, {user?.email?.split("@")[0] || "Compliance Lead"}.
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Here is your organizational compliance posture at a glance.
          </p>
        </div>
      </div>

      {/* Grid of Dynamic Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Card 1: Controls Summary with In Remediation (Blue) included */}
        {can(["controls:read"]) && (
          <section className="md:col-span-2 p-6 bg-surface border border-border rounded-2xl shadow-lg">
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

            {/* Multi-segmented posture progress bar */}
            <div className="w-full bg-surface-raised h-2.5 rounded-full overflow-hidden mb-6 flex">
              <div
                className="bg-emerald-500 h-full transition-all duration-500"
                style={{ width: `${counts.total ? (counts.passing / counts.total) * 100 : 0}%` }}
                title={`${counts.passing} Passing`}
              />
              <div
                className="bg-sky-500 h-full transition-all duration-500"
                style={{ width: `${counts.total ? (counts.inRemediation / counts.total) * 100 : 0}%` }}
                title={`${counts.inRemediation} In Remediation`}
              />
              <div
                className="bg-amber-500 h-full transition-all duration-500"
                style={{ width: `${counts.total ? (counts.stale / counts.total) * 100 : 0}%` }}
                title={`${counts.stale} Stale`}
              />
              <div
                className="bg-rose-500 h-full transition-all duration-500"
                style={{ width: `${counts.total ? (counts.failing / counts.total) * 100 : 0}%` }}
                title={`${counts.failing} Failing`}
              />
            </div>

            {/* Status Breakdown Grid including In Remediation (Blue) */}
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
          </section>
        )}

        {/* Card 2: Frameworks Enabled */}
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
                {activeFrameworkCount} active in your workspace ({frameworks.length - activeFrameworkCount} available in catalog).
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

        {/* Placeholders per Spec */}
        {can(["risks:read"]) && (
          <div className="p-6 bg-surface border border-border rounded-2xl">
            <ComingSoon
              feature="Risk Summary"
              description="Real-time inherent & residual risk metrics."
            />
          </div>
        )}

        {can(["audits:read"]) && (
          <div className="p-6 bg-surface border border-border rounded-2xl">
            <ComingSoon
              feature="Open Findings"
              description="Active audit cycles & remediation tasks."
            />
          </div>
        )}

        {can(["dpdp:read"]) && (
          <div className="p-6 bg-surface border border-border rounded-2xl">
            <ComingSoon
              feature="Breach Clock"
              description="72-hour DPDP compliance notification monitor."
            />
          </div>
        )}
      </div>
    </div>
  );
}