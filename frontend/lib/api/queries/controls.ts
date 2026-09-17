'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { uploadEvidenceFile } from '@/lib/api/evidence-upload';
import {
  ControlSchema,
  ControlUpdateSchema,
  EvidenceListSchema,
  type Control,
  type ControlUpdate,
  type EvidenceReviewDecision,
} from '@/lib/api/types';

function controlKeys(controlId: string) {
  return {
    detail: ['controls', controlId] as const,
    evidence: ['controls', controlId, 'evidence'] as const,
  };
}

/** GET /v1/controls/{id} */
export function useControl(controlId: string) {
  return useQuery({
    queryKey: controlKeys(controlId).detail,
    queryFn: async () => ControlSchema.parse(await api.get(`/v1/controls/${controlId}`)),
  });
}

/** PATCH /v1/controls/{id} — only reachable from the UI when the caller has controls:write. */
export function useUpdateControl(controlId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (update: ControlUpdate) => {
      const payload = ControlUpdateSchema.parse(update);
      return api.patch(`/v1/controls/${controlId}`, payload);
    },
    onSuccess: (raw) => {
      const updated = ControlSchema.parse(raw);
      queryClient.setQueryData<Control>(controlKeys(controlId).detail, updated);
    },
  });
}

/** GET /v1/controls/{id}/evidence */
export function useControlEvidence(controlId: string) {
  return useQuery({
    queryKey: controlKeys(controlId).evidence,
    queryFn: async () =>
      EvidenceListSchema.parse(await api.get(`/v1/controls/${controlId}/evidence`)),
  });
}

/** POST /v1/evidence — gated on evidence:write in the UI. Reports upload progress via onProgress. */
export function useUploadEvidence(controlId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ file, onProgress }: { file: File; onProgress?: (percent: number) => void }) =>
      uploadEvidenceFile(controlId, file, onProgress),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: controlKeys(controlId).evidence });
    },
  });
}

/** POST /v1/evidence/{id}/review — gated on evidence:review in the UI. */
export function useReviewEvidence(controlId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      evidenceId,
      decision,
    }: {
      evidenceId: string;
      decision: EvidenceReviewDecision;
    }) => api.post(`/v1/evidence/${evidenceId}/review`, { decision }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: controlKeys(controlId).evidence });
    },
  });
}
