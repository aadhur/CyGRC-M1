import { z } from 'zod';
import { CONTROL_STATUS, EVIDENCE_STATUS } from '@/lib/design/status';

/**
 * Wire schemas parse the raw FastAPI response (snake_case) and transform it
 * into the camelCase shape the rest of the app uses. Field names are based on
 * the columns called out in ISSUE-F8 section 7 (Endpoint to Page Reference).
 * If the actual backend serializer differs, update the `z.object` keys below
 * — the rest of the app only depends on the transformed, camelCase type.
 */

export const ControlStatusSchema = z.enum([
  CONTROL_STATUS.PASSING,
  CONTROL_STATUS.FAILING,
  CONTROL_STATUS.STALE,
  CONTROL_STATUS.NOT_ASSESSED,
  CONTROL_STATUS.IN_REMEDIATION,
]);
export type ControlStatus = z.infer<typeof ControlStatusSchema>;

const FrameworkRefSchema = z.object({
  code: z.string(),
  name: z.string(),
});

export const ControlSchema = z
  .object({
    id: z.string(),
    code: z.string(),
    title: z.string(),
    status: ControlStatusSchema,
    framework: FrameworkRefSchema,
    owner: z.string().nullable(),
    notes: z.string().nullable(),
  })
  .transform((c) => ({
    id: c.id,
    code: c.code,
    title: c.title,
    status: c.status,
    framework: c.framework,
    owner: c.owner,
    notes: c.notes,
  }));
export type Control = z.infer<typeof ControlSchema>;

/** Payload for PATCH /v1/controls/{id}. Only owner and notes are editable from this page. */
export const ControlUpdateSchema = z.object({
  owner: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});
export type ControlUpdate = z.infer<typeof ControlUpdateSchema>;

export const EvidenceReviewStatusSchema = z.enum([
  EVIDENCE_STATUS.PENDING,
  EVIDENCE_STATUS.APPROVED,
  EVIDENCE_STATUS.REJECTED,
]);
export type EvidenceReviewStatus = z.infer<typeof EvidenceReviewStatusSchema>;

export const EvidenceSchema = z
  .object({
    id: z.string(),
    file_name: z.string(),
    hash: z.string(),
    review_status: EvidenceReviewStatusSchema,
    collected_at: z.string(), // ISO 8601
  })
  .transform((e) => ({
    id: e.id,
    fileName: e.file_name,
    hash: e.hash,
    reviewStatus: e.review_status,
    collectedAt: e.collected_at,
  }));
export type Evidence = z.infer<typeof EvidenceSchema>;

export const EvidenceListSchema = z.array(EvidenceSchema);

/** Payload for POST /v1/evidence/{id}/review. */
export const EvidenceReviewDecisionSchema = z.enum(['approved', 'rejected']);
export type EvidenceReviewDecision = z.infer<typeof EvidenceReviewDecisionSchema>;
