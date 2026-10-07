"use client";

import React from "react";
import { AlertCircle, AlertTriangle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning";
  isLoading?: boolean;
  disabled?: boolean;
  children?: React.ReactNode;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "warning",
  isLoading = false,
  disabled = false,
  children,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  const isDanger = variant === "danger";

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-sm"
        onClick={() => {
          if (!isLoading) onClose();
        }}
      />

      <div className="relative z-10 w-full max-w-lg rounded-xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl">
        <div className="flex items-start gap-4">
          <div
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border shadow-inner",
              isDanger
                ? "border-rose-800/60 bg-rose-950/50 text-rose-400"
                : "border-amber-800/60 bg-amber-950/50 text-amber-400"
            )}
          >
            {isDanger ? (
              <AlertCircle className="h-5 w-5" />
            ) : (
              <AlertTriangle className="h-5 w-5" />
            )}
          </div>

          <div className="flex-1">
            <h3 className="text-lg font-semibold tracking-tight text-zinc-100">
              {title}
            </h3>

            <div className="mt-2 text-sm leading-relaxed text-zinc-400">
              {description}
            </div>

            {children && <div className="mt-4">{children}</div>}
          </div>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 border-t border-zinc-800/80 pt-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={isLoading}
            onClick={onClose}
            className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:bg-zinc-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {cancelText}
          </button>

          <button
            type="button"
            disabled={disabled || isLoading}
            onClick={() => onConfirm()}
            className={cn(
              "inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50",
              isDanger
                ? "bg-rose-600 hover:bg-rose-500 focus-visible:ring-rose-500"
                : "bg-amber-600 hover:bg-amber-500 focus-visible:ring-amber-500"
            )}
          >
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmModal;