"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/context";
import { AUTH_CONFIG } from "@/lib/auth/config";
import { ShieldCheck, ArrowRight, CircleAlert, FolderLock, Loader2 } from "lucide-react";

export default function OnboardPage() {
  const router = useRouter();
  const { setSessionToken } = useAuth();

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    plan: "Standard",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${AUTH_CONFIG.apiBaseUrl}/v1/onboard`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Workspace onboarding failed.");
      }

      const data = await res.json();
      setSessionToken(data.access_token, data.refresh_token);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "An error occurred during onboarding.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-lg bg-surface border border-border rounded-2xl shadow-2xl p-8 z-10">
        <Link
          href="/login"
          className="text-xs text-slate-400 hover:text-slate-200 transition-colors mb-4 inline-block"
        >
          Back to sign in
        </Link>

        <div className="w-12 h-12 rounded-xl bg-brand-orange/15 border border-brand-orange/40 flex items-center justify-center text-brand-orange mb-4">
          <ShieldCheck size={24} />
        </div>

        <p className="text-xs font-mono font-semibold tracking-wider text-brand-orange uppercase">
          WORKSPACE ONBOARDING
        </p>
        <h1 className="text-2xl font-heading font-bold text-slate-100 mt-1">
          Set up your workspace.
        </h1>

        {error && (
          <div className="p-3 mb-5 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
            <CircleAlert size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Company name</label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Acme Corporation"
              className="w-full px-3.5 py-2.5 bg-surface-raised border border-border rounded-xl text-sm text-slate-200 focus:outline-none focus:border-brand-orange"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Administrator email</label>
            <input
              required
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="you@company.com"
              className="w-full px-3.5 py-2.5 bg-surface-raised border border-border rounded-xl text-sm text-slate-200 focus:outline-none focus:border-brand-orange"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Password</label>
            <input
              required
              minLength={8}
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="At least 8 characters"
              className="w-full px-3.5 py-2.5 bg-surface-raised border border-border rounded-xl text-sm text-slate-200 focus:outline-none focus:border-brand-orange"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Subscription Plan</label>
            <select
              value={form.plan}
              onChange={(e) => setForm({ ...form, plan: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-surface-raised border border-border rounded-xl text-sm text-slate-200 focus:outline-none focus:border-brand-orange"
            >
              <option value="Standard">Standard</option>
              <option value="Enterprise">Enterprise</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 px-4 bg-brand-orange hover:bg-brand-orange-hover text-white font-semibold rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Provisioning workspace...</span>
              </>
            ) : (
              <>
                <span>Create workspace</span>
                <ArrowRight size={17} />
              </>
            )}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-border flex items-center gap-2 text-xs text-slate-500">
          <FolderLock size={14} className="text-brand-orange" />
          <span>Your administrator account is seeded with master frameworks</span>
        </div>
      </div>
    </main>
  );
}