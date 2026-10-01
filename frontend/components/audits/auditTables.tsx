"use client";

import Link from "next/link";
import { AUDIT_STATUS_STYLES } from "@/lib/design/status";

export interface AuditDetailResponse {
  audit_id: string;
  framework_id: string;
  period_start: string;
  period_end: string;
  status: "PLANNING" | "IN_PROGRESS" | "REMEDIATION" | "CLOSED";
  scoped_control_count: number;
  control_ids: string[];
}

interface AuditTableProps {
  audits: AuditDetailResponse[];
}

function StatusBadge({ status }: { status: string }) {
  const cls = AUDIT_STATUS_STYLES[status] ?? "bg-slate-800 text-slate-300 border border-slate-700";
  const labels: Record<string, string> = {
    PLANNING: "Planning",
    IN_PROGRESS: "In Progress",
    REMEDIATION: "Remediation",
    CLOSED: "Closed",
  };
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {labels[status] ?? status}
    </span>
  );
}

// Skeleton row for loading state
export function AuditTableSkeleton() {
  return (
    <div className="rounded-lg border border-slate-800 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-800 bg-slate-900/50">
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wide">Framework</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wide">Assessment Period</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wide">Status</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wide">Scoped Controls</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wide">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {Array.from({ length: 5 }).map((_, i) => (
            <tr key={i} className="bg-slate-900/20">
              <td className="px-4 py-3"><div className="h-4 w-24 bg-slate-800 rounded animate-pulse" /></td>
              <td className="px-4 py-3"><div className="h-4 w-40 bg-slate-800 rounded animate-pulse" /></td>
              <td className="px-4 py-3"><div className="h-5 w-20 bg-slate-800 rounded-full animate-pulse" /></td>
              <td className="px-4 py-3"><div className="h-4 w-16 bg-slate-800 rounded animate-pulse" /></td>
              <td className="px-4 py-3"><div className="h-4 w-10 bg-slate-800 rounded animate-pulse" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AuditTable({ audits }: AuditTableProps) {
  return (
    <div className="rounded-lg border border-slate-800 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-800 bg-slate-900/50">
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wide">
              Framework
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wide">
              Assessment Period
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wide">
              Status
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wide">
              Scoped Controls
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wide">
              Action
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {audits.map((item) => (
            <tr
              key={item.audit_id}
              className="bg-slate-900/20 hover:bg-slate-800/40 transition-colors"
            >
              <td className="px-4 py-3 font-mono text-orange-400 font-medium">
                {item.framework_id}
              </td>
              <td className="px-4 py-3 text-slate-300">
                {item.period_start} — {item.period_end}
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={item.status} />
              </td>
              <td className="px-4 py-3 text-slate-300">
                <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 text-xs font-medium">
                  {item.scoped_control_count} controls
                </span>
              </td>
              <td className="px-4 py-3">
                <Link
                  href={`/audits/${item.audit_id}`}
                  className="text-xs text-blue-400 hover:text-blue-300 font-medium underline underline-offset-2"
                >
                  View
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}