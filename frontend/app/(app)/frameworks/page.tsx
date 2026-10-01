"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api/client";
import { BookOpen, Search, Check, Layers, Loader2, ArrowRight } from "lucide-react";

interface FrameworkItem {
  framework_id: string;
  code: string;
  version: string;
  name: string;
}

interface ControlSummary {
  control_id: string;
  framework_id: string;
}

export default function FrameworksPage() {
  const [frameworks, setFrameworks] = useState<FrameworkItem[]>([]);
  const [controlsCountByFw, setControlsCountByFw] = useState<Record<string, number>>({});
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadFrameworkData() {
      try {
        const [fws, ctrls] = await Promise.all([
          apiFetch<FrameworkItem[]>("/v1/frameworks"),
          apiFetch<ControlSummary[]>("/v1/controls"),
        ]);

        setFrameworks(fws);

        // Count how many controls belong to each framework
        const countMap: Record<string, number> = {};
        ctrls.forEach((c) => {
          countMap[c.framework_id] = (countMap[c.framework_id] || 0) + 1;
        });
        setControlsCountByFw(countMap);
      } catch (err) {
        console.error("Failed to load frameworks:", err);
      } finally {
        setLoading(false);
      }
    }
    loadFrameworkData();
  }, []);

  const visibleFrameworks = frameworks.filter(
    (fw) =>
      fw.name.toLowerCase().includes(query.toLowerCase()) ||
      fw.code.toLowerCase().includes(query.toLowerCase())
  );

  const totalEnabled = Object.values(controlsCountByFw).filter((cnt) => cnt > 0).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-mono font-semibold tracking-wider text-brand-orange uppercase">
            COMPLIANCE STANDARDS
          </p>
          <h1 className="text-2xl font-heading font-bold text-slate-100 mt-1">
            Frameworks Catalog
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Master catalog standards available to your organization.
          </p>
        </div>

        <div className="flex items-center gap-3 font-mono text-xs">
          <span className="px-3 py-1.5 rounded-xl bg-emerald-950/40 border border-emerald-800/40 text-emerald-400">
            {totalEnabled} Enabled
          </span>
          <span className="px-3 py-1.5 rounded-xl bg-surface border border-border text-slate-400">
            {frameworks.length - totalEnabled} Available in Catalog
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 bg-surface border border-border rounded-xl px-4 py-2.5 max-w-md">
        <Search size={16} className="text-slate-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter frameworks by name or code..."
          className="bg-transparent border-none text-sm text-slate-100 focus:outline-none w-full"
        />
      </div>

      {loading ? (
        <div className="p-16 flex items-center justify-center text-slate-400 gap-2">
          <Loader2 size={20} className="animate-spin" />
          <span>Loading master frameworks...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {visibleFrameworks.map((fw) => {
            const count = controlsCountByFw[fw.framework_id] || 0;
            const isEnabled = count > 0;

            return (
              <div
                key={fw.framework_id}
                className="p-6 bg-surface border border-border rounded-2xl shadow-lg flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 rounded-xl bg-brand-orange/15 border border-brand-orange/40 flex items-center justify-center text-brand-orange">
                      <BookOpen size={20} />
                    </div>
                    {isEnabled ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-950/60 border border-emerald-700/60 text-emerald-400">
                        <Check size={12} />
                        <span>Enabled ({count} controls)</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-surface-raised border border-border text-slate-400">
                        <Layers size={12} />
                        <span>Available in Catalog</span>
                      </span>
                    )}
                  </div>

                  <span className="text-xs font-mono text-brand-orange uppercase font-semibold">
                    {fw.code}
                  </span>
                  <h2 className="text-lg font-heading font-bold text-slate-100 mt-1 leading-snug">
                    {fw.name}
                  </h2>
                </div>

                <div className="mt-6 pt-4 border-t border-border flex items-center justify-between text-xs text-slate-400">
                  <span>Version {fw.version}</span>
                  {isEnabled && (
                    <Link
                      href="/controls"
                      className="inline-flex items-center gap-1 text-brand-orange hover:underline font-semibold"
                    >
                      <span>View controls</span>
                      <ArrowRight size={13} />
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}