"use client";

import { StatusBadge } from "@/components/StatusBadge";

export interface Audit {
  audit_id: string;
  framework_id: string;
  period_start: string;
  period_end: string;
  status: "PLANNING" | "IN_PROGRESS" | "REMEDIATION" | "CLOSED" | string;
  scoped_control_count: number;
  control_ids?: string[];
}

interface AuditTableProps {
  audits: Audit[];
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toISOString().slice(0, 10);
}

export function AuditTableSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border">
      <div className="animate-pulse divide-y divide-border">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className="grid grid-cols-5 gap-4 bg-surface px-6 py-5"
          >
            <div className="h-4 rounded bg-surface-raised" />
            <div className="h-4 rounded bg-surface-raised" />
            <div className="h-4 w-24 rounded bg-surface-raised" />
            <div className="h-4 w-20 rounded bg-surface-raised" />
            <div className="h-4 w-28 rounded bg-surface-raised" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AuditTable({ audits }: AuditTableProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-lg">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-surface-raised/60">
            <tr>
              <th className="px-6 py-4 text-xs font-mono uppercase tracking-wider text-slate-400">
                Audit
              </th>
              <th className="px-6 py-4 text-xs font-mono uppercase tracking-wider text-slate-400">
                Framework
              </th>
              <th className="px-6 py-4 text-xs font-mono uppercase tracking-wider text-slate-400">
                Assessment Period
              </th>
              <th className="px-6 py-4 text-xs font-mono uppercase tracking-wider text-slate-400">
                Status
              </th>
              <th className="px-6 py-4 text-xs font-mono uppercase tracking-wider text-slate-400">
                Scoped Controls
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-border">
            {audits.map((audit) => (
              <tr
                key={audit.audit_id}
                className="transition-colors hover:bg-surface-raised/40"
              >
                <td className="px-6 py-4">
                  <span
                    className="font-mono text-xs text-slate-300"
                    title={audit.audit_id}
                  >
                    {audit.audit_id.slice(0, 12)}
                    {audit.audit_id.length > 12 ? "…" : ""}
                  </span>
                </td>

                <td className="px-6 py-4 font-mono text-xs font-medium text-brand-orange">
                  {audit.framework_id}
                </td>

                <td className="px-6 py-4 text-xs text-slate-300">
                  {formatDate(audit.period_start)} —{" "}
                  {formatDate(audit.period_end)}
                </td>

                <td className="px-6 py-4">
                  <StatusBadge
                    status={audit.status}
                    type="audit"
                  />
                </td>

                <td className="px-6 py-4">
                  <span className="rounded-lg border border-border bg-surface-raised px-2 py-1 text-xs font-medium text-slate-300">
                    {audit.scoped_control_count} controls
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}