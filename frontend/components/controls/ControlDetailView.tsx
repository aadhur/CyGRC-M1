'use client';

import { useEffect, useState, type ChangeEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StatusBadge } from '@/components/StatusBadge';
import { EvidenceSection } from '@/components/evidence/EvidenceSection';
import { useAuth } from '@/lib/auth/context';
import { SCOPES } from '@/lib/auth/permissions';
import { useControl, useUpdateControl } from '@/lib/api/queries/controls';
import { ControlUpdateSchema } from '@/lib/api/types';
import { toast } from 'sonner';

export function ControlDetailView({ controlId }: { controlId: string }) {
    const { can } = useAuth();
    const canEdit = can([SCOPES.CONTROLS_WRITE]);

    const { data: control, isLoading, isError } = useControl(controlId);
    const updateControl = useUpdateControl(controlId);

    const [isEditing, setIsEditing] = useState(false);
    const [ownerDraft, setOwnerDraft] = useState('');
    const [notesDraft, setNotesDraft] = useState('');

    useEffect(() => {
        if (control) {
            setOwnerDraft(control.owner ?? '');
            setNotesDraft(control.notes ?? '');
        }
    }, [control]);

    if (isLoading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-8 w-1/3" />
                <Skeleton className="h-40 w-full" />
            </div>
        );
    }

    if (isError || !control) {
        return (
            <p className="text-sm text-destructive">
                This control couldn&apos;t be loaded. Try refreshing the page.
            </p>
        );
    }

    const handleSave = () => {
        const parsed = ControlUpdateSchema.safeParse({
            owner: ownerDraft.trim() === '' ? null : ownerDraft.trim(),
            notes: notesDraft.trim() === '' ? null : notesDraft.trim(),
        });

        if (!parsed.success) {
            toast.error("Couldn't save changes", {
                description: 'Check the owner and notes fields and try again.',
            });
            return;
        }

        updateControl.mutate(parsed.data, {
            onSuccess: () => {
                toast.success('Control updated');
                setIsEditing(false);
            },
            onError: (error) => {
                toast.error('Update failed', {
                    description: error instanceof Error ? error.message : 'Please try again.',
                });
            },
        });
    };

    const handleCancel = () => {
        setOwnerDraft(control.owner ?? '');
        setNotesDraft(control.notes ?? '');
        setIsEditing(false);
    };

    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <div className="flex items-center gap-3">
                    <span className="font-mono text-sm text-muted-foreground">{control.code}</span>
                    <StatusBadge status={control.status} />
                </div>
                <h1 className="text-2xl font-semibold">{control.title}</h1>
                <p className="text-sm text-muted-foreground">
                    {control.framework.name} ({control.framework.code})
                </p>
            </div>

            <Tabs defaultValue="overview">
                <TabsList>
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="evidence">Evidence</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4 pt-4">
                    <div className="rounded-lg border bg-card p-6 space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-medium">Owner &amp; notes</h2>
                            {canEdit && !isEditing && (
                                <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                                    Edit
                                </Button>
                            )}
                        </div>

                        <div className="space-y-1">
                            <label htmlFor="control-owner" className="text-xs text-muted-foreground">
                                Owner
                            </label>
                            {canEdit && isEditing ? (
                                <Input
                                    id="control-owner"
                                    value={ownerDraft}
                                    onChange={(e: ChangeEvent<HTMLInputElement>) => setOwnerDraft(e.target.value)}
                                    className="font-mono"
                                    placeholder="user id or email"
                                />
                            ) : (
                                <p className="font-mono text-sm">{control.owner || '—'}</p>
                            )}
                        </div>

                        <div className="space-y-1">
                            <label htmlFor="control-notes" className="text-xs text-muted-foreground">
                                Notes
                            </label>
                            {canEdit && isEditing ? (
                                <Textarea
                                    id="control-notes"
                                    value={notesDraft}
                                    onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setNotesDraft(e.target.value)}
                                    rows={4}
                                />
                            ) : (
                                <p className="whitespace-pre-wrap text-sm">{control.notes || '—'}</p>
                            )}
                        </div>

                        {canEdit && isEditing && (
                            <div className="flex justify-end gap-2">
                                <Button variant="ghost" onClick={handleCancel} disabled={updateControl.isPending}>
                                    Cancel
                                </Button>
                                <Button onClick={handleSave} disabled={updateControl.isPending}>
                                    {updateControl.isPending ? 'Saving…' : 'Save'}
                                </Button>
                            </div>
                        )}
                    </div>
                </TabsContent>

                <TabsContent value="evidence" className="pt-4">
                    <EvidenceSection controlId={controlId} />
                </TabsContent>
            </Tabs>
        </div>
    );
}