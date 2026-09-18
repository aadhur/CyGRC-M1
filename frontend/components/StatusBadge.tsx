"use client";

import {
  EVIDENCE_STATUS,
  STATUS_STYLES,
  CONTROL_STATUS,
  type ControlStatus,
  type EvidenceStatus,
} from "@/lib/design/status";

type Status = ControlStatus | EvidenceStatus;

const STATUS_LABELS: Record<Status, string> = {
  [CONTROL_STATUS.PASSING]: "Passing",
  [CONTROL_STATUS.FAILING]: "Failing",
  [CONTROL_STATUS.STALE]: "Stale",
  [CONTROL_STATUS.NOT_ASSESSED]: "Not Assessed",
  [CONTROL_STATUS.IN_REMEDIATION]: "In Remediation",
  [EVIDENCE_STATUS.PENDING]: "Pending",
  [EVIDENCE_STATUS.APPROVED]: "Approved",
  [EVIDENCE_STATUS.REJECTED]: "Rejected",
};

type StatusBadgeProps = {
  status: Status;
};

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}