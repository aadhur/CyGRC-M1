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
    },
    {
      label: "Controls",
      href: "/controls",
      icon: FileCheck2,
      visible: canAny(["controls:read"]),
    },
    {
      label: "Frameworks",
      href: "/frameworks",
      icon: Layers3,
      visible: canAny(["frameworks:read"]),
    },
    {
      label: "Team",
      href: "/settings/team",
      icon: Users,
      visible: canAny(["users:read"]),
    },
    {
      label: "Platform Operator",
      href: "/operator",
      icon: Terminal,
      visible: canAny(["operator:admin", "operator:break-glass"]),
    },
    {
      label: "Audit Log",
      href: "/audit-log",
      icon: FileCheck2,
      visible: canAny(["auditlog:read"]),
    },
    {
      label: "Risk Register",
      href: "/risks",
      icon: Shield,
      visible: canAny(["risks:read"]),
    },
    {
      label: "Audit Cycles",
      href: "/audits",
      icon: Activity,
      visible: canAny(["audits:read"]),
    },
    {
      label: "DPDP Compliance",
      href: "/dpdp",
      icon: Database,
      visible: canAny(["dpdp:read"]),
    },
  ];

  const primaryRole =
    user?.roles?.find((r) =>
      [
        "PLATFORM_OPERATOR",
        "TENANT_ADMIN",
        "COMPLIANCE_MANAGER",
        "INTERNAL_AUDITOR",
        "RISK_OWNER",
        "CISO",
        "DPO",
        "ENGINEERING_LEAD",
      ].includes(r.toUpperCase())
    )?.replaceAll("_", " ") || "USER";

  return (
    <aside className="w-64 bg-surface border-r border-border h-screen sticky top-0 flex flex-col shrink-0 select-none">
      {/* Brand Header */}
      <div className="h-16 flex items-center px-6 border-b border-border gap-2.5 shrink-0">
        <span className="w-8 h-8 rounded-lg bg-brand-orange/15 border border-brand-orange/40 flex items-center justify-center text-brand-orange font-bold">
          <ShieldCheck size={18} />
        </span>
        <span className="font-heading font-bold text-lg tracking-wide text-slate-100">
          CYGRC
        </span>
      </div>

      {/* Navigation Links (Scrollable area) */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
        {NAV_ITEMS.filter((item) => item.visible).map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                isActive
                  ? "bg-brand-orange text-white font-semibold shadow-md"
                  : "text-slate-400 hover:text-slate-100 hover:bg-surface-raised/60"
              }`}
            >
              <Icon size={16} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom Footer: Tenant Admin Card & Sign Out grouped tightly together */}
      <div className="p-4 border-t border-border space-y-2 mt-auto shrink-0 bg-surface">
        <div className="p-2.5 rounded-xl bg-surface-raised/70 border border-border flex items-center gap-2.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
          <div className="overflow-hidden">
            <div className="text-xs font-semibold text-slate-200 uppercase truncate font-mono">
              {primaryRole}
            </div>
            <div className="text-[10px] text-slate-500 font-mono truncate">
              {user?.email || "Active session"}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={logout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 transition-colors cursor-pointer"
        >
          <LogOut size={14} />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}