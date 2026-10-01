"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { HTTP_ACTION_TAGS } from "@/lib/design/status";

export interface AuditLogEntry {
  log_id: string;
  actor_id: string | null;
  action: string;
  target: string;
  status_code: number;
  request_id?: string;
  ip_address: string | null;
  user_agent?: string | null;
  created_at: string;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to legacy path
  }
  try {
    const el = document.createElement("textarea");
    el.value = text;
    el.setAttribute("readonly", "");
    el.style.position = "fixed";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}

function CopyableUuid({ value }: { value: string | null }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  if (!value) {
    return <span className="text-muted-foreground">—</span>;
  }

  async function handleCopy() {
    const ok = await copyText(value as string);
    if (!ok) return;
    setCopied(true);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex max-w-[11rem] items-center gap-1.5">
      <span
        className="truncate font-mono text-xs text-muted-foreground"
        title={value}
      >
        {value}
      </span>
      <button
        type="button"
        onClick={handleCopy}
        aria-label="Copy actor UUID"
        title={copied ? "Copied" : "Copy"}
        className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground cursor-pointer"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-emerald-400" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </button>
    </div>
  );
}

function ActionTag({ action }: { action: string }) {
  const method = action.trim().split(/\s+/)[0]?.toUpperCase() ?? action;
  const cls =
    HTTP_ACTION_TAGS[method] ??
    "bg-slate-800/80 text-slate-400 border border-slate-700/50";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-2 py-0.5 font-mono text-xs font-semibold",
        cls,
      )}
    >
      {action}
    </span>
  );
}

export default function AuditLogTable({ logs }: { logs: AuditLogEntry[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full table-fixed text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <th className="w-44 px-4 py-3">Timestamp</th>
              <th className="w-28 px-4 py-3">Action</th>
              <th className="px-4 py-3">Target</th>
              <th className="w-52 px-4 py-3">Actor UUID</th>
              <th className="w-28 px-4 py-3">Status Code</th>
              <th className="w-36 px-4 py-3">IP Address</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {logs.map((log) => (
              <tr key={log.log_id} className="transition-colors hover:bg-muted/30">
                <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-muted-foreground">
                  {formatTimestamp(log.created_at)}
                </td>
                <td className="px-4 py-3">
                  <ActionTag action={log.action} />
                </td>
                <td className="px-4 py-3">
                  <span
                    className="block truncate font-mono text-xs text-foreground"
                    title={log.target}
                  >
                    {log.target}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <CopyableUuid value={log.actor_id} />
                </td>
                <td className="px-4 py-3 font-mono text-xs text-foreground">
                  {log.status_code}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                  {log.ip_address ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}