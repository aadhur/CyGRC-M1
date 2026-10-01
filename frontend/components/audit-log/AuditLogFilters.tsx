"use client";

import { Search } from "lucide-react";

export const ACTION_FILTER_OPTIONS = ["ALL", "POST", "PATCH", "DELETE"] as const;
export type ActionFilter = (typeof ACTION_FILTER_OPTIONS)[number];

interface AuditLogFiltersProps {
  action: ActionFilter;
  onActionChange: (value: ActionFilter) => void;
  target: string;
  onTargetChange: (value: string) => void;
}

export default function AuditLogFilters({
  action,
  onActionChange,
  target,
  onTargetChange,
}: AuditLogFiltersProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div>
        <label
          htmlFor="audit-log-action-filter"
          className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground"
        >
          Action
        </label>
        <select
          id="audit-log-action-filter"
          value={action}
          onChange={(e) => onActionChange(e.target.value as ActionFilter)}
          className="w-full rounded-lg border border-input bg-muted px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring sm:w-40"
        >
          {ACTION_FILTER_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {opt === "ALL" ? "All actions" : opt}
            </option>
          ))}
        </select>
      </div>

      <div className="flex-1">
        <label
          htmlFor="audit-log-target-search"
          className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground"
        >
          Target
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            id="audit-log-target-search"
            type="search"
            value={target}
            onChange={(e) => onTargetChange(e.target.value)}
            placeholder="Search target…"
            className="w-full rounded-lg border border-input bg-muted py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>
    </div>
  );
}