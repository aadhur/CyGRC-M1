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
    badgeClass: "bg-emerald-950/60 text-emerald-400 border border-emerald-700/50",
    dotClass: "bg-emerald-400",
  },
  FAILING: {
    label: "Failing",
    badgeClass: "bg-rose-950/60 text-rose-400 border border-rose-700/50",
    dotClass: "bg-rose-400",
  },
  STALE: {
    label: "Stale",
    badgeClass: "bg-amber-950/60 text-amber-400 border border-amber-700/50",
    dotClass: "bg-amber-400",
  },
  NOT_ASSESSED: {
    label: "Not Assessed",
    badgeClass: "bg-slate-800/80 text-slate-400 border border-slate-700/50",
    dotClass: "bg-slate-400",
  },
  IN_REMEDIATION: {
    label: "In Remediation",
    badgeClass: "bg-sky-950/60 text-sky-400 border border-sky-700/50",
    dotClass: "bg-sky-400",
  },
};

export const EVIDENCE_STATUS_MAP: Record<string, StatusConfig> = {
  PENDING: {
    label: "Pending",
    badgeClass: "bg-amber-950/60 text-amber-400 border border-amber-700/50",
    dotClass: "bg-amber-400",
  },
  APPROVED: {
    label: "Approved",
    badgeClass: "bg-emerald-950/60 text-emerald-400 border border-emerald-700/50",
    dotClass: "bg-emerald-400",
  },
  REJECTED: {
    label: "Rejected",
    badgeClass: "bg-rose-950/60 text-rose-400 border border-rose-700/50",
    dotClass: "bg-rose-400",
  },
};