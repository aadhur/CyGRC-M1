"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/context";
import { apiFetch } from "@/lib/api/client";
import { HTTP_ACTION_TAGS } from "@/lib/design/status";
import { ForbiddenState } from "@/components/ForbiddenState";
import { Search, Loader2, Copy, Check } from "lucide-react";

export interface AuditLogEntry {
  log_id: string;
  actor_id: string | null;
  action: string;
  target: string;
  status_code: number;
  request_id?: string;
  ip_address: string | null;
  user_agent?: string | null;
  created_at: string;
}

interface AssigneeItem {
  user_id: string;
  email: string;
}

function AuditLogTable({ logs = [] }: { logs?: AuditLogEntry[] }) {
  const [assigneeMap, setAssigneeMap] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<AssigneeItem[]>("/v1/controls/assignees")
      .then((users) => {
        const map: Record<string, string> = {};
        (users || []).forEach((u) => {
          map[u.user_id] = u.email;
        });
        setAssigneeMap(map);
      })
      .catch(() => {});
  }, []);

  const copyActor = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const safeLogs = Array.isArray(logs) ? logs : [];

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-lg">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-raised/60 text-xs font-mono uppercase text-slate-400 border-b border-border">
            <tr>
              <th className="px-6 py-4">Timestamp</th>
              <th className="px-6 py-4">Action</th>
              <th className="px-6 py-4">Target Resource</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Actor</th>
              <th className="px-6 py-4">IP Address</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {safeLogs.map((log) => {
              const actorEmail = log.actor_id
                ? assigneeMap[log.actor_id] || `${log.actor_id.slice(0, 8)}...`
                : "System";

              return (
                <tr key={log.log_id} className="hover:bg-surface-raised/30 transition-colors">
                  <td className="px-6 py-4 font-mono text-xs text-slate-300">
                    {new Date(log.created_at).toLocaleString()}
                  </td>

                  <td className="px-6 py-4">
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-bold font-mono ${
                        HTTP_ACTION_TAGS[log.action?.toUpperCase()] ||
                        "bg-slate-800 text-slate-300"
                      }`}
                    >
                      {log.action}
                    </span>
                  </td>

                  <td className="px-6 py-4 font-mono text-xs text-slate-200">
                    {log.target}
                  </td>

                  <td className="px-6 py-4">
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-bold font-mono ${
                        log.status_code < 400
                          ? "text-emerald-400 bg-emerald-950/40"
                          : "text-rose-400 bg-rose-950/40"
                      }`}
                    >
                      {log.status_code}
                    </span>
                  </td>

                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-surface-raised border border-border flex items-center justify-center text-[10px] font-bold text-brand-orange shrink-0 font-mono">
                        {actorEmail.slice(0, 2).toUpperCase()}
                      </div>
                      <span
                        className="text-xs text-slate-200 truncate max-w-[200px]"
                        title={log.actor_id || "System"}
                      >
                        {actorEmail}
                      </span>
                      {log.actor_id && (
                        <button
                          type="button"
                          onClick={() => copyActor(log.actor_id!)}
                          className="text-slate-500 hover:text-slate-300 ml-1 cursor-pointer"
                          title="Copy UUID"
                        >
                          {copiedId === log.actor_id ? (
                            <Check size={12} className="text-emerald-400" />
                          ) : (
                            <Copy size={12} />
                          )}
                        </button>
                      )}
                    </div>
                  </td>

                  <td className="px-6 py-4 font-mono text-xs text-slate-500">
                    {log.ip_address || "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function AuditLogPage() {
  const { can } = useAuth();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState("ALL");
  const [searchTarget, setSearchTarget] = useState("");

  useEffect(() => {
    apiFetch<any>("/v1/audit-log")
      .then((res) => {
        const rawLogs = Array.isArray(res?.audit_logs)
          ? res.audit_logs
          : Array.isArray(res)
          ? res
          : [];
        setLogs(rawLogs);
      })
      .catch((err) => {
        console.error("Failed to load audit logs:", err);
        setLogs([]);
      })
      .finally(() => setLoading(false));
  }, []);

  if (!can(["auditlog:read"])) {
    return (
      <ForbiddenState message="You do not possess permission to inspect audit logs." />
    );
  }

  const safeLogs = Array.isArray(logs) ? logs : [];

  const filteredLogs = safeLogs.filter((log) => {
    const matchesAction =
      actionFilter === "ALL" || log.action?.toUpperCase() === actionFilter;
    const matchesSearch = (log.target || "")
      .toLowerCase()
      .includes(searchTarget.toLowerCase());
    return matchesAction && matchesSearch;
  });

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-mono font-semibold tracking-wider text-brand-orange uppercase">
          FORENSICS & COMPLIANCE LOGS
        </p>
        <h1 className="text-2xl font-heading font-bold text-slate-100 mt-1">
          System Activity Log
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Immutable audit record of all tenant mutations and security operations.
        </p>
      </div>

      <section className="p-4 bg-surface border border-border rounded-2xl flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[240px] flex items-center gap-2 bg-surface-raised border border-border rounded-xl px-3 py-2">
          <Search size={16} className="text-slate-400" />
          <input
            value={searchTarget}
            onChange={(e) => setSearchTarget(e.target.value)}
            placeholder="Filter by target (e.g. controls::)..."
            className="bg-transparent border-none text-sm text-slate-100 focus:outline-none w-full"
          />
        </div>

        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="bg-surface-raised border border-border rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none cursor-pointer"
        >
          <option value="ALL">All Actions</option>
          <option value="POST">POST</option>
          <option value="PATCH">PATCH</option>
          <option value="DELETE">DELETE</option>
        </select>

        <span className="text-xs font-mono text-slate-400 ml-auto">
          {filteredLogs.length} events
        </span>
      </section>

      <section>
        {loading ? (
          <div className="p-16 flex items-center justify-center text-slate-400 gap-2 bg-surface border border-border rounded-2xl">
            <Loader2 size={20} className="animate-spin text-brand-orange" />
            <span>Loading audit log entries...</span>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm bg-surface border border-border rounded-2xl">
            No audit log entries match your filter.
          </div>
        ) : (
          <AuditLogTable logs={filteredLogs} />
        )}
      </section>
    </div>
  );
}