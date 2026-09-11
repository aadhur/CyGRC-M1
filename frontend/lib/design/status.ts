/**
 * Design Status Tokens
 * Maps control statuses and evidence review statuses to color tokens
 * Used across the application for consistent visual feedback
 */

// Control Status Colors
export const CONTROL_STATUS_COLORS: Record<string, string> = {
  passing: 'bg-green-600 text-white',
  failing: 'bg-red-600 text-white',
  stale: 'bg-amber-600 text-white',
  not_assessed: 'bg-gray-600 text-white',
  in_remediation: 'bg-blue-600 text-white',
};

export const CONTROL_STATUS_LABELS: Record<string, string> = {
  passing: 'Passing',
  failing: 'Failing',
  stale: 'Stale',
  not_assessed: 'Not Assessed',
  in_remediation: 'In Remediation',
};

export const CONTROL_STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  passing: 'default',
  failing: 'destructive',
  stale: 'secondary',
  not_assessed: 'outline',
  in_remediation: 'secondary',
};

// Evidence Review Status Colors
export const EVIDENCE_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-600 text-white',
  approved: 'bg-green-600 text-white',
  rejected: 'bg-red-600 text-white',
};

export const EVIDENCE_STATUS_LABELS: Record<string, string> = {
  pending: 'Pending Review',
  approved: 'Approved',
  rejected: 'Rejected',
};

export const EVIDENCE_STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  pending: 'secondary',
  approved: 'default',
  rejected: 'destructive',
};

/**
 * Get color class for control status
 */
export function getControlStatusColor(status: string): string {
  return CONTROL_STATUS_COLORS[status.toLowerCase()] || CONTROL_STATUS_COLORS.not_assessed;
}

/**
 * Get label for control status
 */
export function getControlStatusLabel(status: string): string {
  return CONTROL_STATUS_LABELS[status.toLowerCase()] || 'Unknown';
}

/**
 * Get badge variant for control status
 */
export function getControlStatusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  return CONTROL_STATUS_VARIANTS[status.toLowerCase()] || 'outline';
}

/**
 * Get color class for evidence review status
 */
export function getEvidenceStatusColor(status: string): string {
  return EVIDENCE_STATUS_COLORS[status.toLowerCase()] || EVIDENCE_STATUS_COLORS.pending;
}

/**
 * Get label for evidence review status
 */
export function getEvidenceStatusLabel(status: string): string {
  return EVIDENCE_STATUS_LABELS[status.toLowerCase()] || 'Unknown';
}

/**
 * Get badge variant for evidence status
 */
export function getEvidenceStatusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  return EVIDENCE_STATUS_VARIANTS[status.toLowerCase()] || 'outline';
}
