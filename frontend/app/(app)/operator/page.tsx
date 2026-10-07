"use client";

import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth/context";
import {
  apiFetch,
  getActiveBreakGlassSessionId,
  clearDeadBreakGlassSession,
} from "@/lib/api/client";
import { ConfirmModal } from "@/components/ConfirmModal";
import { ForbiddenState } from "@/components/ForbiddenState";
import {
  Terminal,
  Activity,
  AlertOctagon,
  Clock,
  CheckCircle2,
  Loader2,
  ArrowDownCircle,
  LogIn,
  LogOut,
  X,
  AlertTriangle,
  AlertCircle,
  Check,
} from "lucide-react";

interface TenantItem {
  tenant_id: string;
  name: string;
  status: string;
  plan: string;
  created_at: string;
}

interface BreakGlassSessionItem {
  session_id: string;
  target_tenant_id: string;
  requested_by: string;
  requested_by_email?: string | null;
  approved_by?: string | null;
  ticket_ref: string;
  reason: string;
  duration_hours: number;
  status: "PENDING" | "ACTIVE" | "EXPIRED" | "REVOKED";
  created_at: string;
  approved_at?: string | null;
  expires_at?: string | null;
}

interface ToastMessage {
  text: string;
  type: "success" | "error" | "warning";
}

export default function OperatorPage() {
  const { user, can } = useAuth();
  const formRef = useRef<HTMLFormElement>(null);

  const [tenants, setTenants] = useState<TenantItem[]>([]);
  const [tenantsLoading, setTenantsLoading] = useState(false);

  const [sessions, setSessions] = useState<BreakGlassSessionItem[]>([]);
  const [currentActiveSessionId, setCurrentActiveSessionId] = useState<string | null>(null);

  // Live timer tick for accurate countdown calculations
  const [now, setNow] = useState<number>(Date.now());

  const [bgForm, setBgForm] = useState({
    target_tenant_id: "",
    ticket_ref: "",
    reason: "",
    duration_hours: 2,
  });

  const [revokeSessionId, setRevokeSessionId] = useState<string | null>(null);
  const [revokeReason, setRevokeReason] = useState("");
  const [revoking, setRevoking] = useState(false);

  // In-app Notification Banner State (Replaces native browser alert popups)
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const showToast = (text: string, type: "success" | "error" | "warning" = "success") => {
    setToast({ text, type });
    setTimeout(() => {
      setToast((prev) => (prev?.text === text ? null : prev));
    }, 4500);
  };

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const loadTenants = async () => {
    setTenantsLoading(true);
    try {
      const res = await apiFetch<any>("/v1/operators/tenants");
      const list = Array.isArray(res) ? res : res?.tenants || [];
      setTenants(list);
    } catch (err: any) {
      console.error("Failed to load tenants:", err);
    } finally {
      setTenantsLoading(false);
    }
  };

  const loadSessions = async () => {
    try {
      const res = await apiFetch<BreakGlassSessionItem[]>("/v1/operators/break-glass");
      setSessions(res || []);
    } catch (err: any) {
      console.error("Failed to load break-glass sessions:", err);
    }
  };

  useEffect(() => {
    loadTenants();
    if (can(["operator:break-glass"])) {
      loadSessions();
    }
    setCurrentActiveSessionId(getActiveBreakGlassSessionId());
  }, []);

  const handleSelectTenantFromTable = (tenantId: string) => {
    setBgForm((prev) => ({ ...prev, target_tenant_id: tenantId }));
    formRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleRequestBreakGlass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bgForm.target_tenant_id) {
      showToast("Please select a target customer tenant.", "warning");
      return;
    }

    try {
      await apiFetch("/v1/operators/break-glass", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bgForm),
      });
      setBgForm({ target_tenant_id: "", ticket_ref: "", reason: "", duration_hours: 2 });
      await loadSessions();
      showToast(
        "Break-glass request submitted. A peer operator must approve it before access is unlocked.",
        "success"
      );
    } catch (err: any) {
      showToast(err.message || "Failed to submit request.", "error");
    }
  };

  const handleApprove = async (sessionId: string) => {
    try {
      await apiFetch(`/v1/operators/break-glass/${sessionId}/approve`, {
        method: "POST",
      });
      await loadSessions();
      showToast(
        "Session approved. The elevation countdown has started and workspace entry is unlocked.",
        "success"
      );
    } catch (err: any) {
      showToast(err.message || "Approval failed.", "error");
    }
  };

  const handleEnterSession = (session: BreakGlassSessionItem) => {
    if (session.status !== "ACTIVE") {
      showToast("Entry restricted: this session requires approval from a peer operator.", "warning");
      return;
    }

    if (session.expires_at && new Date(session.expires_at).getTime() <= now) {
      showToast("Cannot enter: this emergency session has expired.", "error");
      return;
    }

    const payload = JSON.stringify({
      sessionId: session.session_id,
      tenantId: session.target_tenant_id,
      ticketRef: session.ticket_ref,
      expiresAt: session.expires_at,
    });

    sessionStorage.setItem("cygrc_break_glass_session", payload);
    localStorage.setItem("cygrc_break_glass_session", payload);
    window.dispatchEvent(new Event("cygrc:break-glass-change"));
    window.location.reload();
  };

  const handleExitSession = () => {
    clearDeadBreakGlassSession();
    setCurrentActiveSessionId(null);
    window.location.reload();
  };

  const handleRevokeConfirm = async () => {
    if (!revokeSessionId) return;
    setRevoking(true);
    try {
      await apiFetch(`/v1/operators/break-glass/${revokeSessionId}/revoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: revokeReason }),
      });
      if (currentActiveSessionId === revokeSessionId) {
        clearDeadBreakGlassSession();
      }
      setRevokeSessionId(null);
      setRevokeReason("");
      await loadSessions();
      showToast("Emergency session successfully revoked.", "success");
    } catch (err: any) {
      showToast(err.message || "Revocation failed.", "error");
    } finally {
      setRevoking(false);
    }
  };

  if (!can(["operator:admin"]) && !can(["operator:break-glass"])) {
    return <ForbiddenState message="Platform Operator console is restricted to operator roles." />;
  }

  const pendingSessions = sessions.filter((s) => s.status === "PENDING");
  const activeSessions = sessions.filter((s) => s.status === "ACTIVE");

  // Helper to format remaining time after approval
  const formatCountdown = (expiresAt: string | null | undefined) => {
    if (!expiresAt) return "Starts on approval";
    const diff = new Date(expiresAt).getTime() - now;
    if (diff <= 0) return "Expired";
    const totalSec = Math.floor(diff / 1000);
    const hours = Math.floor(totalSec / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)} remaining`;
  };

  return (
    <div className="space-y-8 relative">
      {/* Toast Notification Card */}
      {toast && (
        <div
          className={`fixed top-6 right-8 z-50 px-4 py-3 rounded-xl border shadow-2xl flex items-center gap-3 text-xs font-semibold backdrop-blur-md transition-all duration-300 ${
            toast.type === "success"
              ? "bg-emerald-950/95 border-emerald-600/70 text-emerald-200"
              : toast.type === "warning"
              ? "bg-amber-950/95 border-amber-600/70 text-amber-200"
              : "bg-rose-950/95 border-rose-600/70 text-rose-200"
          }`}
        >
          {toast.type === "success" && <Check className="h-4 w-4 text-emerald-400 shrink-0" />}
          {toast.type === "warning" && <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />}
          {toast.type === "error" && <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />}
          <span>{toast.text}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="ml-3 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
      )}

      <div>
        <p className="text-xs font-mono font-semibold tracking-wider text-brand-orange uppercase">
          PLATFORM OPERATIONS
        </p>
        <h1 className="text-2xl font-heading font-bold text-slate-100 mt-1">
          Operator Console & Emergency Control
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Inspect customer tenants and manage dual-control break-glass emergency elevation sessions.
        </p>
      </div>

      {can(["operator:break-glass"]) && (
        <div className="space-y-6">
          {/* Section 1: Request Emergency Access */}
          <section className="p-6 bg-surface border border-border rounded-2xl space-y-4 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-400">
                <AlertOctagon size={20} />
              </div>
              <div>
                <h2 className="text-lg font-heading font-semibold text-slate-100">
                  Request Emergency Break-Glass Access
                </h2>
                <p className="text-xs text-slate-400">
                  Dual-control authorization: another operator must approve before elevation is granted.
                </p>
              </div>
            </div>

            <form ref={formRef} onSubmit={handleRequestBreakGlass} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Target Customer Tenant *
                </label>
                <select
                  required
                  value={bgForm.target_tenant_id}
                  onChange={(e) => setBgForm({ ...bgForm, target_tenant_id: e.target.value })}
                  className="w-full px-3 py-2 bg-surface-raised border border-border rounded-xl text-xs font-mono text-slate-200 focus:outline-none focus:border-brand-orange cursor-pointer"
                >
                  <option value="">-- Select a Customer Tenant --</option>
                  {tenants.map((t) => (
                    <option key={t.tenant_id} value={t.tenant_id}>
                      {t.name} ({t.plan}) — {t.tenant_id.slice(0, 8)}...
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Ticket Reference (e.g. INC-90145) *
                </label>
                <input
                  required
                  pattern="^[A-Z]+-[0-9]{3,10}$"
                  value={bgForm.ticket_ref}
                  onChange={(e) => setBgForm({ ...bgForm, ticket_ref: e.target.value.toUpperCase() })}
                  placeholder="e.g. INC-90145"
                  className="w-full px-3 py-2 bg-surface-raised border border-border rounded-xl text-xs font-mono text-slate-200 focus:outline-none focus:border-brand-orange"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Reason for Emergency Access (min 10 chars) *
                </label>
                <textarea
                  required
                  minLength={10}
                  rows={2}
                  value={bgForm.reason}
                  onChange={(e) => setBgForm({ ...bgForm, reason: e.target.value })}
                  placeholder="State the customer support incident, outage, or forensic investigation context..."
                  className="w-full px-3 py-2 bg-surface-raised border border-border rounded-xl text-xs text-slate-200 focus:outline-none focus:border-brand-orange"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Duration Window: {bgForm.duration_hours} hours (starts after approval)
                </label>
                <input
                  type="range"
                  min={1}
                  max={8}
                  value={bgForm.duration_hours}
                  onChange={(e) => setBgForm({ ...bgForm, duration_hours: Number(e.target.value) })}
                  className="w-full accent-brand-orange cursor-pointer"
                />
              </div>

              <div className="flex items-end justify-end">
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs rounded-xl shadow transition-colors cursor-pointer"
                >
                  Submit Break-Glass Request
                </button>
              </div>
            </form>
          </section>

          {/* Section 2: Pending Approvals (Dual Control) */}
          <section className="bg-surface border border-border rounded-2xl overflow-hidden shadow-lg p-6 space-y-4">
            <h3 className="text-sm font-mono uppercase text-slate-400 font-semibold tracking-wider">
              Pending Approvals (Dual Control)
            </h3>
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-raised/60 font-mono text-slate-400">
                <tr>
                  <th className="p-3">Target Tenant</th>
                  <th className="p-3">Ticket</th>
                  <th className="p-3">Requested Window</th>
                  <th className="p-3">Reason</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pendingSessions.map((s) => {
                  const isOwnRequest = user?.sub === s.requested_by || user?.userId === s.requested_by;
                  const matchedTenant = tenants.find((t) => t.tenant_id === s.target_tenant_id);

                  return (
                    <tr key={s.session_id}>
                      <td className="p-3 font-mono text-slate-300">
                        {matchedTenant
                          ? `${matchedTenant.name} (${s.target_tenant_id.slice(0, 8)}...)`
                          : `${s.target_tenant_id.slice(0, 8)}...`}
                      </td>
                      <td className="p-3 font-bold text-slate-100">{s.ticket_ref}</td>
                      <td className="p-3 text-slate-400 font-mono">
                        {s.duration_hours}h (starts on peer approval)
                      </td>
                      <td className="p-3 text-slate-300">{s.reason}</td>
                      <td className="p-3 text-right">
                        {isOwnRequest ? (
                          <span
                            className="inline-block px-2.5 py-1 text-[11px] font-mono text-amber-400 bg-amber-950/40 border border-amber-800/40 rounded-lg"
                            title="Dual-control policy: You cannot approve your own request. Log in as operator2 to approve."
                          >
                            Awaiting Peer Sign-off
                          </span>
                        ) : (
                          <button
                            onClick={() => handleApprove(s.session_id)}
                            className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white font-medium rounded-lg cursor-pointer transition-colors shadow-sm"
                          >
                            Approve
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {pendingSessions.length === 0 && (
              <div className="text-center text-slate-500 text-xs py-4">No pending break-glass requests.</div>
            )}
          </section>

          {/* Section 3: Active Elevated Sessions */}
          <section className="bg-surface border border-border rounded-2xl overflow-hidden shadow-lg p-6 space-y-4">
            <h3 className="text-sm font-mono uppercase text-slate-400 font-semibold tracking-wider">
              Active Elevated Sessions (Approved by Peer)
            </h3>
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-raised/60 font-mono text-slate-400">
                <tr>
                  <th className="p-3">Target Tenant</th>
                  <th className="p-3">Ticket</th>
                  <th className="p-3">Time Remaining</th>
                  <th className="p-3 text-right">Emergency Workspace</th>
                  <th className="p-3 text-right">Dual-Control Revoke</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {activeSessions.map((s) => {
                  const matchedTenant = tenants.find((t) => t.tenant_id === s.target_tenant_id);
                  const isCurrentActive = currentActiveSessionId === s.session_id;

                  // 1. Enter Workspace disabled until ACTIVE and not expired
                  const isApproved = s.status === "ACTIVE";
                  const isExpired = s.expires_at ? new Date(s.expires_at).getTime() <= now : false;
                  const canEnter = isApproved && !isExpired;

                  // 2. Strict Dual Control: Revoke can ONLY be performed by a PEER operator who did NOT request it
                  const isRequester = user?.sub === s.requested_by || user?.userId === s.requested_by;
                  const canRevoke = !isRequester;

                  return (
                    <tr key={s.session_id}>
                      <td className="p-3 font-mono text-slate-300">
                        {matchedTenant ? matchedTenant.name : `${s.target_tenant_id.slice(0, 8)}...`}
                      </td>
                      <td className="p-3 font-bold text-slate-100">{s.ticket_ref}</td>
                      <td className="p-3 font-mono text-amber-400 font-semibold">
                        {formatCountdown(s.expires_at)}
                      </td>
                      <td className="p-3 text-right">
                        {isCurrentActive ? (
                          <button
                            type="button"
                            onClick={handleExitSession}
                            className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-950/60 border border-amber-600 text-amber-300 text-xs rounded-lg hover:bg-amber-900 cursor-pointer"
                          >
                            <LogOut size={12} />
                            <span>Exit Session</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={!canEnter}
                            onClick={() => handleEnterSession(s)}
                            title={
                              !isApproved
                                ? "Disabled: Awaiting peer operator approval."
                                : isExpired
                                ? "Disabled: Session has expired."
                                : "Enter elevated workspace"
                            }
                            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                              canEnter
                                ? "bg-emerald-700 hover:bg-emerald-600 text-white cursor-pointer shadow-sm"
                                : "bg-slate-800/80 border border-slate-700 text-slate-500 cursor-not-allowed opacity-60"
                            }`}
                          >
                            <LogIn size={12} />
                            <span>Enter Workspace</span>
                          </button>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <button
                          type="button"
                          disabled={!canRevoke}
                          onClick={() => setRevokeSessionId(s.session_id)}
                          title={
                            canRevoke
                              ? "Revoke peer emergency session"
                              : "Dual-control policy: You cannot revoke a break-glass session you requested. A peer operator must revoke it."
                          }
                          className={`px-3 py-1 rounded-lg text-xs transition-colors ${
                            canRevoke
                              ? "bg-rose-950/60 border border-rose-800 text-rose-400 hover:bg-rose-900 cursor-pointer shadow-sm"
                              : "bg-slate-900/60 border border-slate-800 text-slate-600 cursor-not-allowed opacity-40"
                          }`}
                        >
                          Revoke
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {activeSessions.length === 0 && (
              <div className="text-center text-slate-500 text-xs py-4">No active emergency sessions.</div>
            )}
          </section>
        </div>
      )}

      {/* Global Tenant Registry */}
      <section className="p-6 bg-surface border border-border rounded-2xl space-y-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-heading font-semibold text-slate-100 flex items-center gap-2">
              <Terminal size={18} className="text-brand-orange" />
              <span>Global Tenant Registry</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Inspect active corporate tenants across the platform or select one for break-glass elevation.
            </p>
          </div>
          <button
            onClick={loadTenants}
            disabled={tenantsLoading}
            className="flex items-center gap-2 px-3.5 py-1.5 bg-surface-raised border border-border text-xs text-slate-300 font-semibold rounded-xl hover:border-brand-orange transition cursor-pointer"
          >
            <Activity size={14} className={tenantsLoading ? "animate-spin text-brand-orange" : ""} />
            <span>{tenantsLoading ? "Refreshing..." : "Refresh Registry"}</span>
          </button>
        </div>

        <div className="overflow-x-auto border border-border rounded-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-raised/60 font-mono text-slate-400">
              <tr>
                <th className="p-3">Tenant Name</th>
                <th className="p-3">Tenant ID</th>
                <th className="p-3">Plan</th>
                <th className="p-3">Status</th>
                <th className="p-3">Created</th>
                <th className="p-3 text-right">Quick Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {tenants.map((t) => (
                <tr key={t.tenant_id} className="hover:bg-surface-raised/40 transition-colors">
                  <td className="p-3 font-semibold text-slate-200">{t.name}</td>
                  <td className="p-3 font-mono text-slate-400">{t.tenant_id}</td>
                  <td className="p-3 text-slate-300">{t.plan}</td>
                  <td className="p-3 text-emerald-400 font-mono">{t.status}</td>
                  <td className="p-3 text-slate-500 font-mono">{new Date(t.created_at).toLocaleDateString()}</td>
                  <td className="p-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleSelectTenantFromTable(t.tenant_id)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-brand-orange/40 bg-brand-orange/10 text-brand-orange hover:bg-brand-orange/20 text-[11px] font-semibold transition cursor-pointer"
                    >
                      <ArrowDownCircle size={12} />
                      <span>Select</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {tenants.length === 0 && !tenantsLoading && (
            <div className="p-8 text-center text-slate-500 text-xs">
              No tenants loaded yet. Click "Refresh Registry" above.
            </div>
          )}
        </div>
      </section>

      {/* Revocation Confirm Modal */}
      {revokeSessionId && (
        <ConfirmModal
          isOpen={true}
          title="Revoke Break-Glass Elevation"
          description="Are you sure you want to terminate this emergency operator session? Immediate revocation is logged."
          confirmText="Revoke Access"
          variant="danger"
          isLoading={revoking}
          onConfirm={handleRevokeConfirm}
          onClose={() => {
            setRevokeSessionId(null);
            setRevokeReason("");
          }}
        >
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Revocation Reason (min 5 characters) *
            </label>
            <input
              type="text"
              required
              minLength={5}
              value={revokeReason}
              onChange={(e) => setRevokeReason(e.target.value)}
              placeholder="Incident resolved or ticket closed..."
              className="w-full px-3 py-2 bg-surface-raised border border-border rounded-xl text-sm text-slate-200 focus:outline-none focus:border-brand-orange"
            />
          </div>
        </ConfirmModal>
      )}
    </div>
  );
}