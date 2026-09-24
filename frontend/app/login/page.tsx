"use client";

import React from "react";
import Link from "next/link";
import { AUTH_CONFIG } from "@/lib/auth/config";
import { ShieldCheck, ArrowRight, FolderLock, Plus } from "lucide-react";

export default function LoginPage() {
  const handleSignIn = () => {
    window.location.href = AUTH_CONFIG.loginUrl;
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-background relative overflow-hidden">
      <div className="w-full max-w-md bg-surface border border-border rounded-2xl shadow-2xl p-8 z-10">
        <div className="flex items-center justify-center mb-6">
          <p className="text-2xl font-mono font-semibold tracking-wider text-brand-orange uppercase">
            Welcome to CyGRC Platform
          </p>
        </div>
        <div className="space-y-3">
          <button
            onClick={handleSignIn}
            className="w-full py-3 px-4 bg-brand-orange hover:bg-brand-orange-hover text-white font-semibold rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all"
          >
            <span>Sign in with Keycloak</span>
            <ArrowRight size={17} />
          </button>

          <Link
            href="/onboard"
            className="w-full py-3 px-4 bg-surface-raised hover:bg-surface-raised/80 border border-border text-slate-200 font-semibold rounded-xl flex items-center justify-center gap-2 transition-all text-sm"
          >
            <span>Set up your workspace</span>
            <Plus size={16} />
          </Link>
        </div>

        <div className="mt-8 pt-6 border-t border-border flex items-center gap-2 text-xs text-slate-500">
          <FolderLock size={14} className="text-brand-orange" />
          <span>Single sign-on protected by Keycloak</span>
        </div>
      </div>
    </main>
  );
}