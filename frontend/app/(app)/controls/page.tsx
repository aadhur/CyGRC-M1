"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/context";
import { StatusBadge } from "@/components/StatusBadge";
import { Search, ArrowRight, Loader2, RefreshCw } from "lucide-react";

interface ControlItem {
  control_id: string;
  code: string;
  title: string;
  description: string;
  owner: string;
  owner_email?: string | null;
  status: string;
  framework_id: string;
}

interface FrameworkItem {
  framework_id: string;
  code: string;
}

interface AssigneeItem {
  user_id: string;
  email: string;
  role: string;
}

export default function ControlsPage() {
  const { can } = useAuth();
  const [controls, setControls] = useState<ControlItem[]>([]);
  const [frameworks, setFrameworks] = useState<FrameworkItem[]>([]);
  const [assigneeMap, setAssigneeMap] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");
  const [selectedFramework, setSelectedFramework] = useState("ALL");
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);

  const loadData = async () => {
    try {
      const [ctrls, fws, assignees] = await Promise.all([
        apiFetch<ControlItem[]>("/v1/controls"),
        apiFetch<FrameworkItem[]>("/v1/frameworks"),
        apiFetch<AssigneeItem[]>("/v1/controls/assignees").catch(() => []),
      ]);
      setControls(ctrls || []);
      setFrameworks(fws || []);

      const map: Record<string, string> = {};
      (assignees || []).forEach((a) => {
        map[a.user_id] = a.email;
      });
      setAssigneeMap(map);
    } catch (err) {
      console.error("Failed to load controls:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRecalculateAll = async () => {
    setCalculating(true);
    try {
      await apiFetch("/v1/controls/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ control_id: null }),
      });
      await loadData();
    } catch (err: any) {
      alert(err.message || "Failed to recalculate controls.");
    } finally {
      setCalculating(false);
    }
  };

  const filteredControls = controls.filter((ctrl) => {
    const matchesQuery =
      ctrl.code.toLowerCase().includes(query.toLowerCase()) ||
      ctrl.title.toLowerCase().includes(query.toLowerCase()) ||
      ctrl.description.toLowerCase().includes(query.toLowerCase());

    const matchesFw =
      selectedFramework === "ALL" || ctrl.framework_id === selectedFramework;

    const matchesStatus =
      selectedStatus === "ALL" || ctrl.status === selectedStatus;

    return matchesQuery && matchesFw && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-mono font-semibold tracking-wider text-brand-orange uppercase">
            CONTROL LIBRARY
          </p>
          <h1 className="text-2xl font-heading font-bold text-slate-100 mt-1">
            Compliance Controls
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Review control definitions, assigned owners, and evidence requirements.
          </p>
        </div>

        {can(["controls:write"]) && (
          <button
            onClick={handleRecalculateAll}
            disabled={calculating}
            className="flex items-center gap-2 px-4 py-2.5 bg-surface border border-border hover:border-brand-orange text-xs font-semibold rounded-xl text-slate-200 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={calculating ? "animate-spin text-brand-orange" : ""} />
            <span>{calculating ? "Evaluating..." : "Recalculate All Controls"}</span>
          </button>
        )}
      </div>

      {/* Filter Toolbar */}
      <section className="p-4 bg-surface border border-border rounded-2xl flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[240px] flex items-center gap-2 bg-surface-raised border border-border rounded-xl px-3 py-2">
          <Search size={16} className="text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by code, title, or keywords..."
            className="bg-transparent border-none text-sm text-slate-100 focus:outline-none w-full"
          />
        </div>

        <select
          value={selectedFramework}
          onChange={(e) => setSelectedFramework(e.target.value)}
          className="bg-surface-raised border border-border rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none"
        >
          <option value="ALL">All Frameworks</option>
          {frameworks.map((fw) => (
            <option key={fw.framework_id} value={fw.framework_id}>
              {fw.code}
            </option>
          ))}
        </select>

        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="bg-surface-raised border border-border rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none"
        >
          <option value="ALL">All Statuses</option>
          <option value="PASSING">Passing</option>
          <option value="FAILING">Failing</option>
          <option value="STALE">Stale</option>
          <option value="IN_REMEDIATION">In Remediation</option>
          <option value="NOT_ASSESSED">Not Assessed</option>
        </select>

        <span className="text-xs font-mono text-slate-400 ml-auto">
          {filteredControls.length} controls
        </span>
      </section>

      {/* Controls Table */}
      <section className="bg-surface border border-border rounded-2xl overflow-hidden shadow-lg">
        {loading ? (
          <div className="p-16 flex items-center justify-center text-slate-400 gap-2">
            <Loader2 size={20} className="animate-spin" />
            <span>Loading controls library...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-raised/60 text-xs font-mono uppercase text-slate-400 border-b border-border">
                <tr>
                  <th className="px-6 py-4">Control</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Owner</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredControls.map((ctrl) => {
                  const resolvedEmail =
                    assigneeMap[ctrl.owner] || ctrl.owner_email || "Unassigned";

                  return (
                    <tr
                      key={ctrl.control_id}
                      className="hover:bg-surface-raised/40 transition-colors group cursor-pointer"
                    >
                      <td className="px-6 py-4">
                        <Link href={`/controls/${ctrl.control_id}`} className="block">
                          <span className="font-mono font-bold text-brand-orange">
                            {ctrl.code}
                          </span>
                          <div className="font-medium text-slate-200 mt-0.5">
                            {ctrl.title}
                          </div>
                        </Link>
                      </td>

                      <td className="px-6 py-4">
                        <StatusBadge status={ctrl.status} />
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-surface-raised border border-border flex items-center justify-center text-[10px] font-bold text-brand-orange shrink-0">
                            {resolvedEmail.slice(0, 2).toUpperCase()}
                          </div>
                          <span
                            className="text-xs text-slate-200 truncate max-w-[220px]"
                            title={resolvedEmail}
                          >
                            {resolvedEmail}
                          </span>
                        </div>
                      </td>

                      <td className="px-6 py-4 text-right">
                        <Link
                          href={`/controls/${ctrl.control_id}`}
                          className="inline-flex items-center gap-1 text-xs text-slate-400 group-hover:text-brand-orange transition-colors"
                        >
                          <span>View</span>
                          <ArrowRight size={14} />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredControls.length === 0 && (
              <div className="p-12 text-center text-slate-500 text-sm">
                No controls found matching your criteria.
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}