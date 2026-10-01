"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ShieldCheck,
  Layers3,
  FileCheck2,
  Users,
  Terminal,
  Shield,
  Activity,
  Database,
  FolderLock,
  LayoutDashboard,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/lib/auth/context";

export function AppSidebar() {
  const pathname = usePathname();
  const { user, canAny, logout } = useAuth();

  const NAV_ITEMS = [
    {
      label: "Dashboard",
      href: "/dashboard",
      icon: LayoutDashboard,
      visible: true,
      locked: false,
    },
    {
      label: "Controls",
      href: "/controls",
      icon: FileCheck2,
      visible: canAny(["controls:read"]),
      locked: false,
    },
    {
      label: "Frameworks",
      href: "/frameworks",
      icon: Layers3,
      visible: canAny(["frameworks:read"]),
      locked: false,
    },
    {
      label: "Team",
      href: "/settings/team",
      icon: Users,
      visible: canAny(["users:read"]),
      locked: false,
    },
    {
      label: "Platform Operator",
      href: "/operator",
      icon: Terminal,
      visible: canAny(["operator:admin", "operator:break-glass"]),
      locked: false,
    },
    {
      label: "Audit Log",
      href: "/audit-log",
      icon: FileCheck2,
      visible: canAny(["auditlog:read"]),
      locked: true,
    },
    {
      label: "Risk Register",
      href: "/risks",
      icon: Shield,
      visible: canAny(["risks:read"]),
      locked: true,
    },
    {
      label: "Audit Cycles",
      href: "/audits",
      icon: Activity,
      visible: canAny(["audits:read"]),
      locked: true,
    },
    {
      label: "DPDP Compliance",
      href: "/dpdp",
      icon: Database,
      visible: canAny(["dpdp:read"]),
      locked: true,
    },
  ];

  return (
    <aside className="w-64 bg-surface border-r border-border min-h-screen flex flex-col justify-between shrink-0">
      <div>
        <div className="h-16 flex items-center px-6 border-b border-border gap-2.5">
          <span className="w-8 h-8 rounded-lg bg-brand-orange/15 border border-brand-orange/40 flex items-center justify-center text-brand-orange font-bold">
            <ShieldCheck size={18} />
          </span>
          <span className="font-heading font-bold text-lg tracking-wide text-slate-100">
            CYGRC
          </span>
        </div>

        <div className="p-4">
          <div className="p-3 bg-surface-raised border border-border rounded-xl flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-brand-orange/20 text-brand-orange font-bold flex items-center justify-center text-xs">
              {user?.email?.slice(0, 2).toUpperCase() || "WS"}
            </div>
            <div className="overflow-hidden">
              <div className="text-sm font-semibold text-slate-200 truncate">
                Workspace
              </div>  
            </div>
          </div>
        </div>

        <nav className="px-3 space-y-1">
          {NAV_ITEMS.filter((item) => item.visible).map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-brand-orange text-white font-semibold shadow-md"
                    : "text-slate-400 hover:text-slate-100 hover:bg-surface-raised"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon size={16} />
                  <span>{item.label}</span>
                </div>
                {item.locked && (
                  <FolderLock size={13} className="text-slate-500" />
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="p-4 border-t border-border space-y-3">
        <div className="p-2.5 rounded-lg bg-surface-raised border border-border flex items-center gap-2.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <div className="overflow-hidden">
            <div className="text-xs font-semibold text-slate-200 uppercase truncate">
              {user?.roles?.[0]?.replaceAll("_", " ") || "USER"}
            </div>
            <div className="text-[10px] text-slate-500 font-mono truncate">
              {user?.email}
            </div>
          </div>
        </div>

        <button
          onClick={logout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 transition-colors"
        >
          <LogOut size={14} />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}