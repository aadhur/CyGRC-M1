"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth/context";
import { apiFetch } from "@/lib/api/client";
import { ForbiddenState } from "@/components/ForbiddenState";
import { BookOpen, Search, Check, Layers, Loader2, ArrowRight, Plus, X } from "lucide-react";

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
  const { can } = useAuth();
  const [frameworks, setFrameworks] = useState<FrameworkItem[]>([]);
  const [controlsCountByFw, setControlsCountByFw] = useState<Record<string, number>>({});
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  // Modal state for adding a new master framework
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [fwForm, setFwForm] = useState({ code: "", version: "", name: "" });
  const [creating, setCreating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadFrameworkData = async () => {
    try {
      // 1. Always fetch frameworks (caller has frameworks:read)
      const fws = await apiFetch<FrameworkItem[]>("/v1/frameworks");
      setFrameworks(fws || []);

      // 2. ONLY fetch controls if the user has controls:read!
      // Platform Operators DO NOT have controls:read, so skip to prevent 403 crashes
      if (can(["controls:read"])) {
        apiFetch<ControlSummary[]>("/v1/controls")
          .then((ctrls) => {
            const countMap: Record<string, number> = {};
            (ctrls || []).forEach((c) => {
              countMap[c.framework_id] = (countMap[c.framework_id] || 0) + 1;
            });
            setControlsCountByFw(countMap);
          })
          .catch(() => {});
      }
    } catch (err) {
      console.error("Failed to load frameworks:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFrameworkData();
  }, [can]);

  const handleCreateFramework = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setErrorMsg(null);
    try {
      await apiFetch("/v1/frameworks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: fwForm.code.trim().toUpperCase(),
          version: fwForm.version.trim(),
          name: fwForm.name.trim(),
        }),
      });
      setAddModalOpen(false);
      setFwForm({ code: "", version: "", name: "" });
      await loadFrameworkData();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to create framework.");
    } finally {
      setCreating(false);
    }
  };

  if (!can(["frameworks:read"])) {
    return <ForbiddenState message="You do not possess permission to view frameworks." />;
  }

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
            Master catalog standards available across the platform.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {can(["controls:read"]) && (
            <div className="flex items-center gap-3 font-mono text-xs">
              <span className="px-3 py-1.5 rounded-xl bg-emerald-950/40 border border-emerald-800/40 text-emerald-400">
                {totalEnabled} Enabled
              </span>
              <span className="px-3 py-1.5 rounded-xl bg-surface border border-border text-slate-400">
                {frameworks.length - totalEnabled} Available in Catalog
              </span>
            </div>
          )}

          {can(["frameworks:write"]) && (
            <button
              onClick={() => setAddModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-brand-orange hover:bg-brand-orange-hover text-white text-xs font-semibold rounded-xl shadow transition-colors cursor-pointer"
            >
              <Plus size={16} />
              <span>Add Framework</span>
            </button>
          )}
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
          <Loader2 size={20} className="animate-spin text-brand-orange" />
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
                    {can(["controls:read"]) ? (
                      isEnabled ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-950/60 border border-emerald-700/60 text-emerald-400">
                          <Check size={12} />
                          <span>Enabled ({count} controls)</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-surface-raised border border-border text-slate-400">
                          <Layers size={12} />
                          <span>Available in Catalog</span>
                        </span>
                      )
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-surface-raised border border-border text-slate-400">
                        <Layers size={12} />
                        <span>Master Standard</span>
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
                  {isEnabled && can(["controls:read"]) && (
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

      {/* Add Master Framework Modal */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <button
              onClick={() => setAddModalOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-100"
            >
              <X size={18} />
            </button>
            <h3 className="text-lg font-heading font-semibold text-slate-100 mb-1">
              Add Master Framework
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Register a new compliance standard to the shared global catalog.
            </p>

            {errorMsg && (
              <div className="p-3 mb-4 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleCreateFramework} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Framework Code (e.g. SOC2:2017) *
                </label>
                <input
                  required
                  value={fwForm.code}
                  onChange={(e) => setFwForm({ ...fwForm, code: e.target.value })}
                  placeholder="e.g. SOC2:2017"
                  className="w-full px-3 py-2 bg-surface-raised border border-border rounded-xl text-xs font-mono text-slate-200 focus:outline-none focus:border-brand-orange"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Version Identifier *
                </label>
                <input
                  required
                  value={fwForm.version}
                  onChange={(e) => setFwForm({ ...fwForm, version: e.target.value })}
                  placeholder="e.g. 2017"
                  className="w-full px-3 py-2 bg-surface-raised border border-border rounded-xl text-xs text-slate-200 focus:outline-none focus:border-brand-orange"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Full Name *
                </label>
                <input
                  required
                  value={fwForm.name}
                  onChange={(e) => setFwForm({ ...fwForm, name: e.target.value })}
                  placeholder="e.g. SOC 2 Trust Services Criteria 2017"
                  className="w-full px-3 py-2 bg-surface-raised border border-border rounded-xl text-xs text-slate-200 focus:outline-none focus:border-brand-orange"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-400 hover:text-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-5 py-2 bg-brand-orange hover:bg-brand-orange-hover text-white text-xs font-semibold rounded-xl transition disabled:opacity-50"
                >
                  {creating ? "Adding..." : "Add Framework"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}