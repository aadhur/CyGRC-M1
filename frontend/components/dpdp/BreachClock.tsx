"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Clock3, Flame } from "lucide-react";

interface BreachClockProps {
  deadline: string;
}

type ClockLevel = "normal" | "warning" | "urgent" | "critical";

function getClockLevel(remainingSeconds: number): ClockLevel {
  if (remainingSeconds > 48 * 60 * 60) {
    return "normal";
  }

  if (remainingSeconds >= 24 * 60 * 60) {
    return "warning";
  }

  if (remainingSeconds > 6 * 60 * 60) {
    return "urgent";
  }

  return "critical";
}

function formatCountdown(totalSeconds: number) {
  const safeSeconds = Math.max(0, totalSeconds);

  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  return [
    hours.toString().padStart(2, "0"),
    minutes.toString().padStart(2, "0"),
    seconds.toString().padStart(2, "0"),
  ].join(":");
}

const levelStyles: Record<
  ClockLevel,
  {
    card: string;
    icon: string;
    timer: string;
    label: string;
  }
> = {
  normal: {
    card: "border-emerald-800/60 bg-emerald-950/20",
    icon: "border-emerald-800/60 bg-emerald-950/40 text-emerald-400",
    timer: "text-emerald-400",
    label: "Normal",
  },
  warning: {
    card: "border-amber-800/60 bg-amber-950/20",
    icon: "border-amber-800/60 bg-amber-950/40 text-amber-400",
    timer: "text-amber-400",
    label: "Warning",
  },
  urgent: {
    card: "border-rose-800/60 bg-rose-950/20",
    icon: "border-rose-800/60 bg-rose-950/40 text-rose-400",
    timer: "text-rose-400",
    label: "Urgent",
  },
  critical: {
    card: "border-red-700/70 bg-red-950/30",
    icon: "border-red-700/70 bg-red-950/50 text-red-400",
    timer: "text-red-400",
    label: "Critical",
  },
};

export default function BreachClock({ deadline }: BreachClockProps) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());

    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(interval);
  }, []);

  const remainingSeconds = useMemo(() => {
    if (now === null) {
      return null;
    }

    return Math.max(
      0,
      Math.floor((new Date(deadline).getTime() - now) / 1000),
    );
  }, [deadline, now]);

  const level = getClockLevel(remainingSeconds ?? 72 * 60 * 60);
  const styles = levelStyles[level];

  const expired = remainingSeconds === 0;

  return (
    <section
      className={`rounded-2xl border p-6 shadow-xl transition ${styles.card}`}
    >
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-4">
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border ${styles.icon}`}
          >
            {level === "critical" ? (
              <Flame className="h-6 w-6" />
            ) : level === "urgent" || level === "warning" ? (
              <AlertTriangle className="h-6 w-6" />
            ) : (
              <Clock3 className="h-6 w-6" />
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-zinc-100">
                DPDP Breach Clock
              </h2>

              <span
                className={`rounded-full border px-2.5 py-1 text-xs font-medium ${styles.icon}`}
              >
                {expired ? "Expired" : styles.label}
              </span>
            </div>

            <p className="mt-1 text-sm text-zinc-400">
              Time remaining to complete the mandatory 72-hour breach
              notification window.
            </p>
          </div>
        </div>

        <div className="text-left md:text-right">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">
            Time remaining
          </p>

          <p
            className={`mt-1 font-mono text-4xl font-bold tracking-tight ${
              level === "critical" ? `${styles.timer} animate-pulse` : styles.timer
            }`}
            aria-live="polite"
          >
            {remainingSeconds === null
              ? "--:--:--"
              : formatCountdown(remainingSeconds)}
          </p>
        </div>
      </div>
    </section>
  );
}