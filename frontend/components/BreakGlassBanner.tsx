"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { AlertTriangle, LogOut } from "lucide-react";
import { BREAK_GLASS_STORAGE_KEY } from "@/lib/api/client";

export interface BreakGlassSessionInfo {
  sessionId: string;
  tenantId: string;
  expiresAt: string;
}

const CHANGE_EVENT = "cygrc:break-glass-change";

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function getRawSnapshot(): string | null {
  try {
    return window.sessionStorage.getItem(BREAK_GLASS_STORAGE_KEY);
  } catch {
    return null;
  }
}

function getServerSnapshot(): string | null {
  return null;
}

function parseSession(raw: string | null): BreakGlassSessionInfo | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<BreakGlassSessionInfo>;
    if (parsed.sessionId && parsed.tenantId && parsed.expiresAt) {
      return parsed as BreakGlassSessionInfo;
    }
  } catch {
    // ignore malformed value
  }
  return null;
}

export function setBreakGlassSession(info: BreakGlassSessionInfo) {
  try {
    window.sessionStorage.setItem(BREAK_GLASS_STORAGE_KEY, JSON.stringify(info));
  } catch {
    // storage unavailable
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function clearBreakGlassSession() {
  try {
    window.sessionStorage.removeItem(BREAK_GLASS_STORAGE_KEY);
  } catch {
    // storage unavailable
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function useBreakGlassSession(): BreakGlassSessionInfo | null {
  const raw = useSyncExternalStore(subscribe, getRawSnapshot, getServerSnapshot);
  return parseSession(raw);
}

export function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

/**
 * Returns remaining ms until `expiresAt`, ticking once per second.
 * Single interval, cleaned up on unmount / when expiresAt changes.
 * Starts as null so server and first client render match (no hydration drift).
 */
export function useCountdown(expiresAt: string | null | undefined): number | null {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!expiresAt) {
      setRemaining(null);
      return;
    }
    const target = new Date(expiresAt).getTime();
    if (Number.isNaN(target)) {
      setRemaining(null);
      return;
    }
    const tick = () => setRemaining(Math.max(0, target - Date.now()));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [expiresAt]);

  return remaining;
}

export default function BreakGlassBanner() {
  const session = useBreakGlassSession();
  const remaining = useCountdown(session?.expiresAt);

  const exit = useCallback(() => clearBreakGlassSession(), []);

  // Auto-exit once the session has expired.
  useEffect(() => {
    if (session && remaining === 0) {
      clearBreakGlassSession();
    }
  }, [session, remaining]);

  if (!session) return null;

  return (
    <div
      role="alert"
      className="sticky top-0 z-40 flex flex-wrap items-center justify-between gap-3 border-b-2 border-amber-400 bg-[repeating-linear-gradient(45deg,#451a03,#451a03_14px,#78350f_14px,#78350f_28px)] px-6 py-2.5 text-amber-100 shadow-lg"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-amber-300">
          <AlertTriangle className="h-4 w-4" />
          Break-Glass Session Active
        </span>
        <span className="text-xs">
          Tenant:{" "}
          <span className="font-mono font-semibold">{session.tenantId}</span>
        </span>
        <span className="text-xs">
          Remaining:{" "}
          <span
            className="font-mono font-semibold tabular-nums"
            suppressHydrationWarning
          >
            {remaining === null ? "--:--:--" : formatRemaining(remaining)}
          </span>
        </span>
      </div>
      <button
        type="button"
        onClick={exit}
        className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400/60 bg-black/40 px-3 py-1.5 text-xs font-semibold text-amber-200 transition hover:bg-black/60 cursor-pointer"
      >
        <LogOut className="h-3.5 w-3.5" />
        Exit Session
      </button>
    </div>
  );
}

export { BreakGlassBanner };