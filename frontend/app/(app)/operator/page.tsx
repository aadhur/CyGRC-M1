"use client";

import React, { useState } from "react";
import { apiFetch } from "@/lib/api/client";
import { Terminal, Plus, Activity, Check, CircleAlert, Loader2 } from "lucide-react";

interface TenantItem {
  tenant_id: string;
  name: string;
  status: string;
  plan: string;
  created_at: string;
}

export default function OperatorPage() {
  const [tenants, setTenants] = useState<TenantItem[]>([]);
  const [tenantsLoaded, setTenantsLoaded] = useState(false);
  const [tenantsLoading, setTenantsLoading] = useState(false);

  const [form, setForm] = useState({ code: "", version: "", name: "" });
  const [formLoading, setFormLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleLoadTenants = async () => {
    setTenantsLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ tenants: TenantItem[] }>("/v1/operators/tenants");
      setTenants(res.tenants || []);
      setTenantsLoaded(true);
    } catch (err: any) {
      setError(err.message || "Failed to query tenant registry.");
    } finally {
      setTenantsLoading(false);
    }
  };

  const handleRegisterFramework = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setMessage(null);
    setError(null);
    try {
      await apiFetch("/v1/frameworks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setMessage(`Master Framework '${form.code}' registered successfully.`);
      setForm({ code: "", version: "", name: "" });
    } catch (err: any) {
      setError(err.message || "Failed to register framework.");
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-mono font-semibold tracking-wider text-brand-orange uppercase">
          SYSTEM OPERATIONS
        </p>
        <h1 className="text-2xl font-heading font-bold text-slate-100 mt-1">
          Platform Operator Console
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Administrative control plane for global tenant registries and master catalog definitions.
        </p>
      </div>

      {error && (
        <div className="p-3 bg-rose-950/60 border border-rose-800 text-rose-300 rounded-xl text-xs flex items-center gap-2">
          <CircleAlert size={16} />
          <span>{error}</span>
        </div>
      )}

      {message && (
        <div className="p-3 bg-emerald-950/60 border border-emerald-800 text-emerald-300 rounded-xl text-xs flex items-center gap-2">
          <Check size={16} />
          <span>{message}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Action 1: Tenant Registry Viewer */}
        <section className="p-6 bg-surface border border-border rounded-2xl flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-xl bg-surface-raised border border-border flex items-center justify-center text-slate-300 mb-4">
              <Terminal size={20} />
            </div>
            <h2 className="text-lg font-heading font-bold text-slate-100">
              Tenant Registry
            </h2>
            <p className="text-xs text-slate-400 mt-1 mb-4">
              Query the global non-RLS tenants database to inspect registered workspaces.
            </p>

            <button
              onClick={handleLoadTenants}
              disabled={tenantsLoading}
              className="flex items-center gap-2 px-4 py-2 bg-surface-raised hover:bg-surface-raised/80 border border-border text-xs text-slate-200 font-semibold rounded-xl transition-colors disabled:opacity-50"
            >
              {tenantsLoading ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Activity size={14} />
              )}
              <span>{tenantsLoaded ? "Refresh Tenants" : "Load Tenants"}</span>
            </button>

            {tenantsLoaded && (
              <div className="mt-4 border border-border rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-raised/80 font-mono text-slate-400">
                    <tr>
                      <th className="p-3">Tenant</th>
                      <th className="p-3">Plan</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {tenants.map((t) => (
                      <tr key={t.tenant_id}>
                        <td className="p-3 font-semibold text-slate-200">{t.name}</td>
                        <td className="p-3 text-slate-300">{t.plan}</td>
                        <td className="p-3">
                          <span className="text-emerald-400 font-mono">{t.status}</span>
                        </td>
                        <td className="p-3 font-mono text-slate-500">
                          {new Date(t.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {/* Action 2: Register New Master Framework Form */}
        <section className="p-6 bg-surface border border-border rounded-2xl">
          <div className="w-10 h-10 rounded-xl bg-brand-orange/15 border border-brand-orange/40 flex items-center justify-center text-brand-orange mb-4">
            <Plus size={20} />
          </div>
          <h2 className="text-lg font-heading font-bold text-slate-100">
            Register Master Framework
          </h2>
          <p className="text-xs text-slate-400 mt-1 mb-6">
            Register a standard into the shared platform catalog (POST /v1/frameworks).
          </p>

          <form onSubmit={handleRegisterFramework} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Framework Code
              </label>
              <input
                required
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="e.g. SOC2:2017"
                className="w-full px-3 py-2 bg-surface-raised border border-border rounded-xl text-sm font-mono text-slate-200 focus:outline-none focus:border-brand-orange"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Version Identifier
              </label>
              <input
                required
                value={form.version}
                onChange={(e) => setForm({ ...form, version: e.target.value })}
                placeholder="e.g. 2017"
                className="w-full px-3 py-2 bg-surface-raised border border-border rounded-xl text-sm text-slate-200 focus:outline-none focus:border-brand-orange"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Full Framework Name
              </label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. SOC 2 Trust Services Criteria 2017"
                className="w-full px-3 py-2 bg-surface-raised border border-border rounded-xl text-sm text-slate-200 focus:outline-none focus:border-brand-orange"
              />
            </div>

            <button
              type="submit"
              disabled={formLoading}
              className="w-full py-2.5 bg-brand-orange hover:bg-brand-orange-hover text-white text-xs font-semibold rounded-xl transition-colors shadow flex items-center justify-center gap-2"
            >
              {formLoading && <Loader2 size={14} className="animate-spin" />}
              <span>{formLoading ? "Registering..." : "Register Framework"}</span>
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}