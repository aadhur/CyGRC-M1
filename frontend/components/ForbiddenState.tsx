"use client";

import { ShieldAlert } from "lucide-react";

interface ForbiddenStateProps {
  message?: string;
  title?: string;
}

export function ForbiddenState({
  message = "You do not possess the required permission for this resource.",
  title = "403 — Forbidden",
}: ForbiddenStateProps) {
  return (
    <div className="flex items-center justify-center min-h-[420px] p-6 w-full">
      <div className="max-w-md w-full rounded-xl border border-zinc-800 bg-zinc-950/80 p-8 text-center shadow-xl backdrop-blur-md">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-rose-950/40 text-rose-400 border border-rose-800/60 shadow-inner">
          <ShieldAlert className="h-7 w-7" />
        </div>
        <h2 className="mt-5 text-xl font-bold tracking-tight text-zinc-100">
          {title}
        </h2>
        <p className="mt-2 text-sm text-zinc-400 leading-relaxed">
          {message}
        </p>
      </div>
    </div>
  );
}

export default ForbiddenState;
