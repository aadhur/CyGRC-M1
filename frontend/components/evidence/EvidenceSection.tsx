'use client';

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/StatusBadge';
import { useAuth } from '@/lib/auth/context';
import { SCOPES } from '@/lib/auth/permissions';
import { useControlEvidence, useReviewEvidence } from '@/lib/api/queries/controls';
import type { EvidenceReviewDecision } from '@/lib/api/types';
import { toast } from 'sonner';
import { EvidenceUploadModal } from '@/components/evidence/EvidenceUploadModal';

function truncateHash(hash: string) {
    return hash.length > 14 ? `${hash.slice(0, 7)}…${hash.slice(-6)}` : hash;
}

function formatDate(iso: string) {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function EvidenceSection({ controlId }: { controlId: string }) {
    const { can } = useAuth();
    const canUpload = can([SCOPES.EVIDENCE_WRITE]);
    const canReview = can([SCOPES.EVIDENCE_REVIEW]);

    const { data: evidence, isLoading, isError } = useControlEvidence(controlId);
    const review = useReviewEvidence(controlId);

    const handleReview = (evidenceId: string, fileName: string, decision: EvidenceReviewDecision) => {
        review.mutate(
            { evidenceId, decision },
            {
                onSuccess: () => {
                    toast.success(decision === 'approved' ? 'Evidence approved' : 'Evidence rejected', {
                        description: fileName,
                    });
                },
                onError: (error) => {
                    toast.error('Review failed', {
                        description: error instanceof Error ? error.message : 'Please try again.',
                    });
                },
            }
        );
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-medium">Evidence</h2>
                {canUpload && <EvidenceUploadModal controlId={controlId} />}
            </div>

            {isLoading && (
                <div className="space-y-2">
                    <Skeleton className="h-9 w-full" />
                    <Skeleton className="h-9 w-full" />
                    <Skeleton className="h-9 w-full" />
                </div>
            )}

            {isError && (
                <p className="text-sm text-destructive">Evidence couldn&apos;t be loaded. Try refreshing the page.</p>
            )}

            {evidence && evidence.length === 0 && (
                <p className="text-sm text-muted-foreground">
                    No evidence has been uploaded for this control yet.
                </p>
            )}

            {evidence && evidence.length > 0 && (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>File</TableHead>
                            <TableHead>Hash</TableHead>
                            <TableHead>Review status</TableHead>
                            <TableHead>Collection date</TableHead>
                            {canReview && <TableHead className="text-right">Actions</TableHead>}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {evidence.map((item) => (
                            <TableRow key={item.id}>
                                <TableCell className="max-w-[240px] truncate">{item.fileName}</TableCell>
                                <TableCell>
                                    <Tooltip>
                                        <TooltipTrigger>
                                            <span className="font-mono text-xs">{truncateHash(item.hash)}</span>
                                        </TooltipTrigger>
                                        <TooltipContent className="font-mono text-xs">{item.hash}</TooltipContent>
                                    </Tooltip>
                                </TableCell>
                                <TableCell>
                                    <StatusBadge status={item.reviewStatus} />
                                </TableCell>
                                <TableCell>{formatDate(item.collectedAt)}</TableCell>
                                {canReview && (
                                    <TableCell className="space-x-2 text-right">
                                        {item.reviewStatus === 'pending' ? (
                                            <>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    disabled={review.isPending}
                                                    onClick={() => handleReview(item.id, item.fileName, 'approved')}
                                                >
                                                    Approve
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="destructive"
                                                    disabled={review.isPending}
                                                    onClick={() => handleReview(item.id, item.fileName, 'rejected')}
                                                >
                                                    Reject
                                                </Button>
                                            </>
                                        ) : (
                                            <span className="text-xs text-muted-foreground">Reviewed</span>
                                        )}
                                    </TableCell>
                                )}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            )}
        </div>
    );
}