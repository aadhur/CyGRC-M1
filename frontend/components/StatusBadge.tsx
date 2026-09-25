import React from "react";
import { CONTROL_STATUS_MAP, EVIDENCE_STATUS_MAP } from "@/lib/design/status";

export function StatusBadge({
  status,
  type = "control",
}: {
  status: string;
  type?: "control" | "evidence";
}) {
  const map = type === "control" ? CONTROL_STATUS_MAP : EVIDENCE_STATUS_MAP;
  const config = map[status.toUpperCase()] || {
    label: status,
    badgeClass: "bg-slate-800 text-slate-400 border border-slate-700",
    dotClass: "bg-slate-400",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium tracking-wide ${config.badgeClass}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dotClass}`} />
      {config.label}
    </span>
  );
}