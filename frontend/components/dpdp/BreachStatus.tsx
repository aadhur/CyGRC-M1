"use client";

import { CheckCircle2, CircleAlert, Clock3 } from "lucide-react";

export type BreachStatusValue = "INACTIVE" | "ACTIVE" | "RESOLVED";

interface BreachStatusProps {
  status: BreachStatusValue;
  startedAt?: string | null;
  acknowledgedBy?: string | null;
  resolvedAt?: string | null;
  elapsedSeconds?: number | null;
}

function formatTimestamp(value?: string | null) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(
    2,
    "0",
  )}-${String(date.getUTCDate()).padStart(2, "0")} ${String(
    date.getUTCHours(),
  ).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}:${String(
    date.getUTCSeconds(),
  ).padStart(2, "0")} UTC`;
}

function formatElapsed(totalSeconds?: number | null) {
  if (totalSeconds == null) {
    return "—";
  }

  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  return `${hours}h ${minutes}m ${seconds}s`;
}

export default function BreachStatus({
  status,
  startedAt,
  acknowledgedBy,
  resolvedAt,
  elapsedSeconds,
}: BreachStatusProps) {
  if (status === "INACTIVE") {
    return (
      <section className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-8 shadow-xl">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900 text-zinc-400">
            <Clock3 className="h-7 w-7" />
          </div>

          <h2 className="mt-5 text-xl font-bold text-zinc-100">
            No active breach clock
          </h2>

          <p className="mt-2 max-w-lg text-sm leading-relaxed text-zinc-400">
            No DPDP breach has been declared for this tenant. Declaring a
            breach starts the mandatory 72-hour notification clock.
          </p>
        </div>
      </section>
    );
  }

  if (status === "RESOLVED") {
    return (
      <section className="rounded-2xl border border-emerald-800/60 bg-emerald-950/20 p-6 shadow-xl">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-emerald-800/60 bg-emerald-950/40 text-emerald-400">
            <CheckCircle2 className="h-6 w-6" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-zinc-100">
                Breach resolved
              </h2>

              <span className="rounded-full border border-emerald-800/60 bg-emerald-950/40 px-2.5 py-1 text-xs font-medium text-emerald-400">
                RESOLVED
              </span>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-wider text-zinc-500">
                  Started
                </p>
                <p className="mt-1 text-sm text-zinc-300">
                  {formatTimestamp(startedAt)}
                </p>
              </div>

              <div>
                <p className="text-xs uppercase tracking-wider text-zinc-500">
                  Resolved
                </p>
                <p className="mt-1 text-sm text-zinc-300">
                  {formatTimestamp(resolvedAt)}
                </p>
              </div>

              <div>
                <p className="text-xs uppercase tracking-wider text-zinc-500">
                  Total elapsed
                </p>
                <p className="mt-1 text-sm font-semibold text-emerald-400">
                  {formatElapsed(elapsedSeconds)}
                </p>
              </div>

              <div>
                <p className="text-xs uppercase tracking-wider text-zinc-500">
                  Acknowledged by
                </p>
                <p className="mt-1 break-all text-sm text-zinc-300">
                  {acknowledgedBy || "—"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-rose-800/60 bg-rose-950/20 p-6 shadow-xl">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-rose-800/60 bg-rose-950/40 text-rose-400">
          <CircleAlert className="h-6 w-6" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-zinc-100">
              Breach declared
            </h2>

            <span className="rounded-full border border-rose-800/60 bg-rose-950/40 px-2.5 py-1 text-xs font-medium text-rose-400">
              ACTIVE
            </span>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-wider text-zinc-500">
                Started
              </p>
              <p className="mt-1 text-sm text-zinc-300">
                {formatTimestamp(startedAt)}
              </p>
            </div>

            <div>
              <p className="text-xs uppercase tracking-wider text-zinc-500">
                Acknowledged by
              </p>
              <p className="mt-1 break-all text-sm text-zinc-300">
                {acknowledgedBy || "—"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}