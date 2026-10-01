"use client";

import { ShieldAlert } from "lucide-react";

interface ForbiddenStateProps {
  message?: string;
  title?: string;
}

export function ForbiddenState({
  message = "You do not possess the required permission for this resource.",
  title = "403 — Forbidden.",
}: ForbiddenStateProps) {
  return (
    <div className="flex min-h-[420px] w-full items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-950/80 p-8 text-center shadow-xl backdrop-blur-md">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl border border-rose-800/60 bg-rose-950/40 text-rose-400 shadow-inner">
          <ShieldAlert className="h-7 w-7" />
        </div>

        <h2 className="mt-5 text-xl font-bold tracking-tight text-zinc-100">
          {title}
        </h2>

        <p className="mt-2 text-sm leading-relaxed text-zinc-400">
          {message}
        </p>
      </div>
    </div>
  );
}

export default ForbiddenState;