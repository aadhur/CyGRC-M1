'use client';

import * as React from 'react';
import { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { useUploadEvidence } from '@/lib/api/queries/controls';
import { Upload, FileUp } from 'lucide-react';
import { toast } from 'sonner';

interface EvidenceUploadModalProps {
    controlId: string;
}

export function EvidenceUploadModal({ controlId }: EvidenceUploadModalProps) {
    const [open, setOpen] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [progress, setProgress] = useState(0);

    const uploadMutation = useUploadEvidence(controlId);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleUpload = async () => {
        if (!file) return;

        setProgress(0);
        uploadMutation.mutate(
            {
                file,
                onProgress: (percent) => setProgress(percent),
            },
            {
                onSuccess: () => {
                    toast.success('Evidence uploaded successfully', {
                        description: file.name,
                    });
                    setOpen(false);
                    setFile(null);
                    setProgress(0);
                },
                onError: (err) => {
                    toast.error('Upload failed', {
                        description: err instanceof Error ? err.message : 'Please try again.',
                    });
                },
            }
        );
    };

    const handleOpenChange = (isOpen: boolean) => {
        if (uploadMutation.isPending) return; // Prevent closing mid-upload
        setOpen(isOpen);
        if (!isOpen) {
            setFile(null);
            setProgress(0);
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger render={<Button size="sm" className="gap-2" />}>
                <Upload className="size-4" />
                Upload Evidence
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Upload Evidence</DialogTitle>
                    <DialogDescription>
                        Attach an evidence document or artifact for this control.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    <div className="space-y-2">
                        <Input
                            type="file"
                            onChange={handleFileChange}
                            disabled={uploadMutation.isPending}
                        />
                    </div>

                    {file && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <FileUp className="size-4" />
                            <span>{file.name} ({(file.size / 1024).toFixed(1)} KB)</span>
                        </div>
                    )}

                    {uploadMutation.isPending && (
                        <div className="space-y-1">
                            <div className="flex justify-between text-xs text-muted-foreground">
                                <span>Uploading...</span>
                                <span>{progress}%</span>
                            </div>
                            <Progress value={progress} />
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => setOpen(false)}
                        disabled={uploadMutation.isPending}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleUpload}
                        disabled={!file || uploadMutation.isPending}
                    >
                        {uploadMutation.isPending ? 'Uploading...' : 'Upload'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
