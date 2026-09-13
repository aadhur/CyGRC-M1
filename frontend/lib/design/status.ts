export const CONTROL_STATUS = {
  PASSING: "passing",
  FAILING: "failing",
  STALE: "stale",
  NOT_ASSESSED: "not_assessed",
  IN_REMEDIATION: "in_remediation",
} as const;

export const EVIDENCE_STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
} as const;

export type ControlStatus =
  (typeof CONTROL_STATUS)[keyof typeof CONTROL_STATUS];

export type EvidenceStatus =
  (typeof EVIDENCE_STATUS)[keyof typeof EVIDENCE_STATUS];

export const STATUS_STYLES = {
  passing: "text-green-400 bg-green-400/10",
  failing: "text-red-400 bg-red-400/10",
  stale: "text-amber-400 bg-amber-400/10",
  not_assessed: "text-zinc-400 bg-zinc-400/10",
  in_remediation: "text-blue-400 bg-blue-400/10",

  pending: "text-amber-400 bg-amber-400/10",
  approved: "text-green-400 bg-green-400/10",
  rejected: "text-red-400 bg-red-400/10",
} as const;