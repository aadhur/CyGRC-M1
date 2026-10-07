"use client";

import React from "react";
import { useAuth } from "@/lib/auth/context";
import { usePathname } from "next/navigation";
import { Shield } from "lucide-react";

export function AppTopBar() {
  const { user } = useAuth();
  const pathname = usePathname();

  const titleMap: Record<string, string> = {
    "/dashboard": "Dashboard",
    "/controls": "Controls Library",
    "/frameworks": "Framework Catalog",
    "/settings/team": "Team Management",
    "/operator": "Platform Operator",
    "/risks": "Risk Register",
    "/audits": "Audit Cycles",
    "/dpdp": "DPDP Compliance",
    "/audit-log": "Audit Log",
  };

  const currentTitle = titleMap[pathname] || "Workspace";

  return (
    <header className="h-16 bg-surface border-b border-border flex items-center justify-between px-8 shrink-0">
      <div className="flex items-center gap-2 text-sm">
        <span className="text-slate-500">Workspace</span>
        <span className="text-slate-600">/</span>
        <span className="font-semibold text-slate-200">{currentTitle}</span>
      
        <div className="flex items-center gap-2.5 pl-3 border-l border-border">
          <div className="w-7 h-7 rounded-full bg-surface-raised border border-border flex items-center justify-center text-slate-300 text-xs font-mono">
            <Shield size={14} />
          </div>
          <span className="text-xs font-mono text-slate-300">
            {user?.email || "User"}
          </span>
        </div>
      </div>
    </header>
  );
}