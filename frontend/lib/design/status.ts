export type ControlStatus =
  | "PASSING"
  | "FAILING"
  | "STALE"
  | "NOT_ASSESSED"
  | "IN_REMEDIATION";

export type EvidenceReviewStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface StatusConfig {
  label: string;
  badgeClass: string;
  dotClass: string;
}

export const CONTROL_STATUS_MAP: Record<string, StatusConfig> = {
  PASSING: {
    label: "Passing",
    badgeClass:
      "bg-emerald-950/60 text-emerald-400 border border-emerald-700/50",
    dotClass: "bg-emerald-400",
  },
  FAILING: {
    label: "Failing",
    badgeClass:
      "bg-rose-950/60 text-rose-400 border border-rose-700/50",
    dotClass: "bg-rose-400",
  },
  STALE: {
    label: "Stale",
    badgeClass:
      "bg-amber-950/60 text-amber-400 border border-amber-700/50",
    dotClass: "bg-amber-400",
  },
  NOT_ASSESSED: {
    label: "Not Assessed",
    badgeClass:
      "bg-slate-800/80 text-slate-400 border border-slate-700/50",
    dotClass: "bg-slate-400",
  },
  IN_REMEDIATION: {
    label: "In Remediation",
    badgeClass:
      "bg-sky-950/60 text-sky-400 border border-sky-700/50",
    dotClass: "bg-sky-400",
  },
};

export const EVIDENCE_STATUS_MAP: Record<string, StatusConfig> = {
  PENDING: {
    label: "Pending",
    badgeClass:
      "bg-amber-950/60 text-amber-400 border border-amber-700/50",
    dotClass: "bg-amber-400",
  },
  APPROVED: {
    label: "Approved",
    badgeClass:
      "bg-emerald-950/60 text-emerald-400 border border-emerald-700/50",
    dotClass: "bg-emerald-400",
  },
  REJECTED: {
    label: "Rejected",
    badgeClass:
      "bg-rose-950/60 text-rose-400 border border-rose-700/50",
    dotClass: "bg-rose-400",
  },
};

// Score calculation: Likelihood (1–5) × Impact (1–5)
export function getScoreBadge(score: number) {
  if (score <= 7) {
    return {
      label: "Low",
      className:
        "bg-emerald-950/60 text-emerald-400 border border-emerald-700/60",
    };
  }

  if (score <= 15) {
    return {
      label: "Medium",
      className:
        "bg-amber-950/60 text-amber-400 border border-amber-700/60",
    };
  }

  return {
    label: "High / Critical",
    className:
      "bg-rose-950/60 text-rose-400 border border-rose-700/60",
  };
}

export const AUDIT_VERDICTS: Record<string, string> = {
  PASS:
    "bg-emerald-950/60 text-emerald-400 border border-emerald-700/60",
  FAIL:
    "bg-rose-950/60 text-rose-400 border border-rose-700/60",
  EXCEPTION:
    "bg-amber-950/60 text-amber-400 border border-amber-700/60",
};

export const FINDING_SEVERITIES: Record<string, string> = {
  CRITICAL: "bg-rose-950 text-rose-400 border border-rose-800 font-bold",
  HIGH: "bg-orange-950 text-orange-400 border border-orange-800",
  MEDIUM: "bg-amber-950 text-amber-400 border border-amber-800",
  LOW: "bg-slate-800 text-slate-300 border border-slate-700",
};

export const HTTP_ACTION_TAGS: Record<string, string> = {
  POST:
    "bg-emerald-950/60 text-emerald-400 border border-emerald-700/60",
  PUT:
    "bg-amber-950/60 text-amber-400 border border-amber-700/60",
  PATCH:
    "bg-amber-950/60 text-amber-400 border border-amber-700/60",
  DELETE:
    "bg-rose-950/60 text-rose-400 border border-rose-700/60",
};

export const RISK_STATUS_STYLES: Record<string, string> = {
  OPEN:
    "bg-blue-950/60 text-blue-400 border border-blue-700/60",
  TREATING:
    "bg-amber-950/60 text-amber-400 border border-amber-700/60",
  CLOSED:
    "bg-emerald-950/60 text-emerald-400 border border-emerald-700/60",
  ACCEPTED:
    "bg-purple-950/60 text-purple-400 border border-purple-700/60",
};

export const RISK_TREATMENT_STYLES: Record<string, string> = {
  AVOID:
    "bg-rose-950/60 text-rose-400 border border-rose-700/60",
  MITIGATE:
    "bg-emerald-950/60 text-emerald-400 border border-emerald-700/60",
  TRANSFER:
    "bg-indigo-950/60 text-indigo-400 border border-indigo-700/60",
  ACCEPT:
    "bg-amber-950/60 text-amber-400 border border-amber-700/60",
};