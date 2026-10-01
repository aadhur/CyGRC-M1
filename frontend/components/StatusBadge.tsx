import {
  AUDIT_VERDICTS,
  CONTROL_STATUS_MAP,
  EVIDENCE_STATUS_MAP,
  RISK_STATUS_STYLES,
  type StatusConfig,
} from "@/lib/design/status";

type StatusBadgeType = "control" | "evidence" | "audit" | "risk";

interface StatusBadgeProps {
  status: string;
  type?: StatusBadgeType;
}

function formatStatusLabel(status: string) {
  return status
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function StatusBadge({
  status,
  type = "control",
}: StatusBadgeProps) {
  const normalized = status.toUpperCase();

  let config: StatusConfig | undefined;

  if (type === "control") {
    config = CONTROL_STATUS_MAP[normalized];
  } else if (type === "evidence") {
    config = EVIDENCE_STATUS_MAP[normalized];
  } else if (type === "audit") {
    const badgeClass = AUDIT_VERDICTS[normalized];

    if (badgeClass) {
      config = {
        label: formatStatusLabel(normalized),
        badgeClass,
        dotClass:
          normalized === "PASS"
            ? "bg-emerald-400"
            : normalized === "FAIL"
              ? "bg-rose-400"
              : "bg-amber-400",
      };
    }
  } else if (type === "risk") {
    const badgeClass = RISK_STATUS_STYLES[normalized];

    if (badgeClass) {
      config = {
        label: formatStatusLabel(normalized),
        badgeClass,
        dotClass:
          normalized === "CLOSED"
            ? "bg-emerald-400"
            : normalized === "TREATING"
              ? "bg-amber-400"
              : normalized === "ACCEPTED"
                ? "bg-purple-400"
                : "bg-blue-400",
      };
    }
  }

  const finalConfig = config ?? {
    label: formatStatusLabel(status),
    badgeClass: "border border-slate-700 bg-slate-800 text-slate-400",
    dotClass: "bg-slate-400",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium tracking-wide ${finalConfig.badgeClass}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${finalConfig.dotClass}`} />
      {finalConfig.label}
    </span>
  );
}