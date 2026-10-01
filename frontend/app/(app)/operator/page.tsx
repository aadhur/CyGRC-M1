"use client";

/**
 * Platform Operator Page
 *
 * Provides a cross-tenant administration surface for platform operators.
 *
 * Permissions (scope-based per §2.7 — never role-name based):
 *   - Page access        : operator:admin
 *   - Tenant table       : operator:admin  (GET /v1/operators/tenants)
 *   - Framework creation : operator:admin  (POST /v1/frameworks)
 *   - Break-glass console: operator:admin  (GET/POST /v1/operators/break-glass[...])
 *
 * These are direct client-side calls — no server-side business logic wrapper.
 */

import { useAuth } from "@/lib/auth/context";
import { SCOPES } from "@/lib/auth/permissions";
import { api, ApiError } from "@/lib/api/client";
import { ForbiddenState } from "@/components/ForbiddenState";
import { ConfirmModal } from "@/components/ConfirmModal";
import {
  clearBreakGlassSession,
  setBreakGlassSession,
  useBreakGlassSession,
  useCountdown,
  formatRemaining,
} from "@/components/BreakGlassBanner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ShieldAlert,
  RefreshCw,
  Plus,
  Building2,
  BookOpen,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Siren,
  LogIn,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type TenantStatus = "provisioning" | "active" | "deleting";

interface Tenant {
  tenant_id: string;
  name: string;
  status: TenantStatus;
  plan: string;
  created_at: string;
}

interface Framework {
  framework_id: string;
  code: string;
  version: string;
  name: string;
}

interface CreateFrameworkPayload {
  code: string;
  version: string;
  name: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TENANT_STATUS_CONFIG: Record<
  TenantStatus,
  { label: string; icon: React.ReactNode; className: string }
> = {
  active: {
    label: "Active",
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    className: "text-emerald-400 bg-emerald-400/10 ring-emerald-400/20",
  },
  provisioning: {
    label: "Provisioning",
    icon: <Clock className="h-3.5 w-3.5" />,
    className: "text-amber-400 bg-amber-400/10 ring-amber-400/20",
  },
  deleting: {
    label: "Deleting",
    icon: <XCircle className="h-3.5 w-3.5" />,
    className: "text-red-400 bg-red-400/10 ring-red-400/20",
  },
};

const PLAN_STYLES: Record<string, string> = {
  enterprise: "text-violet-400 bg-violet-400/10 ring-violet-400/20",
  pro:        "text-blue-400   bg-blue-400/10   ring-blue-400/20",
  starter:    "text-zinc-400   bg-zinc-400/10   ring-zinc-400/20",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function TenantStatusBadge({ status }: { status: TenantStatus }) {
  const config =
    TENANT_STATUS_CONFIG[status] ?? TENANT_STATUS_CONFIG.provisioning;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        config.className
      )}
    >
      {config.icon}
      {config.label}
    </span>
  );
}

function PlanBadge({ plan }: { plan: string }) {
  const planKey = plan.toLowerCase();
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset capitalize",
        PLAN_STYLES[planKey] ?? "text-zinc-400 bg-zinc-400/10 ring-zinc-400/20"
      )}
    >
      {plan}
    </span>
  );
}

function SectionCard({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="flex items-start gap-3 border-b border-border px-6 py-5">
        <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </div>
        <div>
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

// ─── Tenant Table ─────────────────────────────────────────────────────────────

function TenantTable() {
  const {
    data: tenants = [],
    isLoading,
    isError,
    refetch,
  } = useQuery<Tenant[]>({
    queryKey: ["operator-tenants"],
    queryFn: () => api.get<Tenant[]>("/v1/operators/tenants"),
  });

  function formatDate(iso: string) {
    try {
      return new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(new Date(iso));
    } catch {
      return iso;
    }
  }

  return (
    <SectionCard
      title="Tenant Registry"
      description="All tenants provisioned on this platform."
      icon={<Building2 className="h-4 w-4" />}
    >
      {/* Controls bar */}
      <div className="flex items-center justify-between border-b border-border px-6 py-3">
        <span className="text-sm text-muted-foreground">
          {isLoading
            ? "Loading…"
            : `${tenants.length} tenant${tenants.length !== 1 ? "s" : ""}`}
        </span>
        <button
          id="refresh-tenants-btn"
          type="button"
          onClick={() => refetch()}
          disabled={isLoading}
          className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
          title="Refresh"
        >
          <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
        </button>
      </div>

      {/* Loading skeleton */}
      {isLoading && (
        <div className="divide-y divide-border">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-6 py-4">
              <div className="flex-1 space-y-2">
                <div className="h-3 w-40 animate-pulse rounded bg-muted" />
                <div className="h-3 w-24 animate-pulse rounded bg-muted" />
              </div>
              <div className="h-6 w-16 animate-pulse rounded-full bg-muted" />
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {isError && !isLoading && (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <ShieldAlert className="h-7 w-7 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Failed to load tenants.</p>
          <button
            type="button"
            onClick={() => refetch()}
            className="text-sm text-primary underline-offset-2 hover:underline"
          >
            Try again
          </button>
        </div>
      )}

      {/* Empty */}
      {!isLoading && !isError && tenants.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-12">
          <p className="text-sm text-muted-foreground">No tenants found.</p>
        </div>
      )}

      {/* Table */}
      {!isLoading && !isError && tenants.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <th className="px-6 py-3">Tenant Name</th>
                <th className="px-6 py-3">Plan</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {tenants.map((tenant) => (
                <tr
                  key={tenant.tenant_id}
                  className="transition-colors hover:bg-muted/30"
                >
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-foreground">
                      {tenant.name}
                    </p>
                    <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                      {tenant.tenant_id}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <PlanBadge plan={tenant.plan} />
                  </td>
                  <td className="px-6 py-4">
                    <TenantStatusBadge status={tenant.status} />
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-muted-foreground">
                      {formatDate(tenant.created_at)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}

// ─── Framework Creation Form ──────────────────────────────────────────────────

function FrameworkForm() {
  const queryClient = useQueryClient();

  const [code, setCode]       = useState("");
  const [version, setVersion] = useState("");
  const [name, setName]       = useState("");
  const [errors, setErrors]   = useState<Partial<Record<"code" | "version" | "name", string>>>({});
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [apiError, setApiError]     = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: (payload: CreateFrameworkPayload) =>
      api.post<Framework>("/v1/frameworks", payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["frameworks"] });
      setCode("");
      setVersion("");
      setName("");
      setErrors({});
      setApiError(null);
      setSuccessMsg(`Framework "${data.name}" (${data.code}) created.`);
      setTimeout(() => setSuccessMsg(null), 5000);
    },
    onError: (err: Error) => {
      setApiError(err.message ?? "Failed to create framework.");
    },
  });

  function validate(): boolean {
    const next: typeof errors = {};
    if (!code.trim())    next.code    = "Code is required.";
    if (!version.trim()) next.version = "Version is required.";
    if (!name.trim())    next.name    = "Name is required.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setApiError(null);
    if (!validate()) return;
    createMutation.mutate({
      code: code.trim().toUpperCase(),
      version: version.trim(),
      name: name.trim(),
    });
  }

  return (
    <SectionCard
      title="Add Framework"
      description="Register a new master compliance framework available to all tenants."
      icon={<BookOpen className="h-4 w-4" />}
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-5 px-6 py-6">
        <div className="grid gap-5 sm:grid-cols-2">
          {/* Code */}
          <div>
            <label
              htmlFor="framework-code"
              className="mb-1.5 block text-sm font-medium text-foreground"
            >
              Code
              <span className="ml-0.5 text-destructive">*</span>
            </label>
            <input
              id="framework-code"
              type="text"
              value={code}
              onChange={(e) => { setCode(e.target.value); setErrors((p) => ({ ...p, code: undefined })); }}
              placeholder="e.g. ISO27001"
              disabled={createMutation.isPending}
              aria-invalid={!!errors.code}
              className={cn(
                "w-full rounded-lg border bg-muted px-3 py-2 font-mono text-sm text-foreground placeholder:font-sans placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50",
                errors.code ? "border-destructive" : "border-input"
              )}
            />
            {errors.code && (
              <p className="mt-1 text-xs text-destructive">{errors.code}</p>
            )}
          </div>

          {/* Version */}
          <div>
            <label
              htmlFor="framework-version"
              className="mb-1.5 block text-sm font-medium text-foreground"
            >
              Version
              <span className="ml-0.5 text-destructive">*</span>
            </label>
            <input
              id="framework-version"
              type="text"
              value={version}
              onChange={(e) => { setVersion(e.target.value); setErrors((p) => ({ ...p, version: undefined })); }}
              placeholder="e.g. 2022"
              disabled={createMutation.isPending}
              aria-invalid={!!errors.version}
              className={cn(
                "w-full rounded-lg border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50",
                errors.version ? "border-destructive" : "border-input"
              )}
            />
            {errors.version && (
              <p className="mt-1 text-xs text-destructive">{errors.version}</p>
            )}
          </div>
        </div>

        {/* Name (full row) */}
        <div>
          <label
            htmlFor="framework-name"
            className="mb-1.5 block text-sm font-medium text-foreground"
          >
            Full Name
            <span className="ml-0.5 text-destructive">*</span>
          </label>
          <input
            id="framework-name"
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); setErrors((p) => ({ ...p, name: undefined })); }}
            placeholder="e.g. ISO/IEC 27001:2022 — Information Security"
            disabled={createMutation.isPending}
            aria-invalid={!!errors.name}
            className={cn(
              "w-full rounded-lg border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50",
              errors.name ? "border-destructive" : "border-input"
            )}
          />
          {errors.name && (
            <p className="mt-1 text-xs text-destructive">{errors.name}</p>
          )}
        </div>

        {/* Feedback */}
        {successMsg && (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
            <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
            {successMsg}
          </div>
        )}
        {apiError && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {apiError}
          </div>
        )}

        {/* Submit */}
        <div className="flex justify-end">
          <button
            id="create-framework-btn"
            type="submit"
            disabled={createMutation.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {createMutation.isPending ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                Creating…
              </>
            ) : (
              <>
                <Plus className="h-3.5 w-3.5" />
                Create framework
              </>
            )}
          </button>
        </div>
      </form>
    </SectionCard>
  );
}

// ─── Break-Glass Console ──────────────────────────────────────────────────────

interface BreakGlassSession {
  session_id: string;
  target_tenant_id: string;
  requested_by: string;
  ticket_ref: string;
  reason: string;
  duration_hours: number;
  status: string;
  created_at: string;
  approved_at?: string | null;
  expires_at?: string | null;
}

interface BreakGlassRequestPayload {
  target_tenant_id: string;
  ticket_ref: string;
  reason: string;
  duration_hours: number;
}

const BREAK_GLASS_KEY = ["operator-break-glass"];
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TICKET_RE = /^INC-[0-9]{3,10}$/;

function formatDateTime(iso?: string | null) {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function errorMessage(err: unknown, fallback: string) {
  return err instanceof Error && err.message ? err.message : fallback;
}

function useBreakGlassSessions() {
  return useQuery<BreakGlassSession[]>({
    queryKey: BREAK_GLASS_KEY,
    queryFn: () => api.get<BreakGlassSession[]>("/v1/operators/break-glass"),
    retry: (count, err) =>
      !(err instanceof ApiError && err.status === 403) && count < 1,
  });
}

function BreakGlassRequestForm() {
  const queryClient = useQueryClient();

  const [tenantId, setTenantId] = useState("");
  const [ticketRef, setTicketRef] = useState("");
  const [reason, setReason] = useState("");
  const [duration, setDuration] = useState("2");
  const [errors, setErrors] = useState<
    Partial<Record<"tenant" | "ticket" | "reason" | "duration", string>>
  >({});
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  const requestMutation = useMutation({
    mutationFn: (payload: BreakGlassRequestPayload) =>
      api.post<{ session_id: string }>("/v1/operators/break-glass", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BREAK_GLASS_KEY });
      setTenantId("");
      setTicketRef("");
      setReason("");
      setDuration("2");
      setErrors({});
      setApiError(null);
      setSuccessMsg("Break-glass request submitted for approval.");
    },
    onError: (err: unknown) => {
      setSuccessMsg(null);
      setApiError(errorMessage(err, "Failed to submit break-glass request."));
    },
  });

  function validate(): boolean {
    const next: typeof errors = {};
    if (!UUID_RE.test(tenantId.trim()))
      next.tenant = "Enter a valid tenant UUID.";
    if (!TICKET_RE.test(ticketRef.trim()))
      next.ticket = "Ticket must look like INC-1234.";
    if (reason.trim().length < 10)
      next.reason = "Reason must be at least 10 characters.";
    const hours = Number(duration);
    if (!Number.isInteger(hours) || hours < 1 || hours > 8)
      next.duration = "Duration must be a whole number from 1 to 8 hours.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setApiError(null);
    setSuccessMsg(null);
    if (!validate()) return;
    requestMutation.mutate({
      target_tenant_id: tenantId.trim(),
      ticket_ref: ticketRef.trim(),
      reason: reason.trim(),
      duration_hours: Number(duration),
    });
  }

  const inputCls = (hasError?: string) =>
    cn(
      "w-full rounded-lg border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50",
      hasError ? "border-destructive" : "border-input"
    );

  return (
    <SectionCard
      title="Request Break-Glass Access"
      description="Request time-boxed emergency access to a tenant. A second operator must approve."
      icon={<Siren className="h-4 w-4" />}
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-5 px-6 py-6">
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label
              htmlFor="bg-tenant-id"
              className="mb-1.5 block text-sm font-medium text-foreground"
            >
              Target Tenant ID<span className="ml-0.5 text-destructive">*</span>
            </label>
            <input
              id="bg-tenant-id"
              type="text"
              value={tenantId}
              onChange={(e) => {
                setTenantId(e.target.value);
                setErrors((p) => ({ ...p, tenant: undefined }));
              }}
              placeholder="00000000-0000-0000-0000-000000000000"
              disabled={requestMutation.isPending}
              aria-invalid={!!errors.tenant}
              className={cn(inputCls(errors.tenant), "font-mono")}
            />
            {errors.tenant && (
              <p className="mt-1 text-xs text-destructive">{errors.tenant}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="bg-ticket-ref"
              className="mb-1.5 block text-sm font-medium text-foreground"
            >
              Ticket Ref<span className="ml-0.5 text-destructive">*</span>
            </label>
            <input
              id="bg-ticket-ref"
              type="text"
              value={ticketRef}
              onChange={(e) => {
                setTicketRef(e.target.value);
                setErrors((p) => ({ ...p, ticket: undefined }));
              }}
              placeholder="INC-1234"
              disabled={requestMutation.isPending}
              aria-invalid={!!errors.ticket}
              className={cn(inputCls(errors.ticket), "font-mono")}
            />
            {errors.ticket && (
              <p className="mt-1 text-xs text-destructive">{errors.ticket}</p>
            )}
          </div>
        </div>

        <div>
          <label
            htmlFor="bg-reason"
            className="mb-1.5 block text-sm font-medium text-foreground"
          >
            Reason<span className="ml-0.5 text-destructive">*</span>
          </label>
          <textarea
            id="bg-reason"
            rows={3}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              setErrors((p) => ({ ...p, reason: undefined }));
            }}
            placeholder="Describe why emergency access is needed (min. 10 characters)"
            disabled={requestMutation.isPending}
            aria-invalid={!!errors.reason}
            className={inputCls(errors.reason)}
          />
          {errors.reason && (
            <p className="mt-1 text-xs text-destructive">{errors.reason}</p>
          )}
        </div>

        <div className="sm:w-48">
          <label
            htmlFor="bg-duration"
            className="mb-1.5 block text-sm font-medium text-foreground"
          >
            Duration (hours)<span className="ml-0.5 text-destructive">*</span>
          </label>
          <input
            id="bg-duration"
            type="number"
            min={1}
            max={8}
            step={1}
            value={duration}
            onChange={(e) => {
              setDuration(e.target.value);
              setErrors((p) => ({ ...p, duration: undefined }));
            }}
            disabled={requestMutation.isPending}
            aria-invalid={!!errors.duration}
            className={inputCls(errors.duration)}
          />
          {errors.duration && (
            <p className="mt-1 text-xs text-destructive">{errors.duration}</p>
          )}
        </div>

        {successMsg && (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
            <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
            {successMsg}
          </div>
        )}
        {apiError && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {apiError}
          </div>
        )}

        <div className="flex justify-end">
          <button
            id="request-break-glass-btn"
            type="submit"
            disabled={requestMutation.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {requestMutation.isPending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Submitting…
              </>
            ) : (
              <>
                <Siren className="h-3.5 w-3.5" />
                Request access
              </>
            )}
          </button>
        </div>
      </form>
    </SectionCard>
  );
}

function SessionsStateBlock({
  isLoading,
  isError,
  onRetry,
  label,
}: {
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  label: string;
}) {
  if (isLoading) {
    return (
      <div className="divide-y divide-border">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-6 py-4">
            <div className="flex-1 space-y-2">
              <div className="h-3 w-48 animate-pulse rounded bg-muted" />
              <div className="h-3 w-28 animate-pulse rounded bg-muted" />
            </div>
            <div className="h-8 w-20 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
    );
  }
  if (isError) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <ShieldAlert className="h-7 w-7 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Failed to load {label}.</p>
        <button
          type="button"
          onClick={onRetry}
          className="text-sm text-primary underline-offset-2 hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }
  return null;
}

function PendingApprovals() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const currentUserId = user?.sub ?? null;
  const { data = [], isLoading, isError, refetch } = useBreakGlassSessions();
  const [actionError, setActionError] = useState<string | null>(null);

  const approveMutation = useMutation({
    mutationFn: (id: string) =>
      api.post(`/v1/operators/break-glass/${id}/approve`),
    onMutate: () => setActionError(null),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BREAK_GLASS_KEY });
    },
    onError: (err: unknown) =>
      setActionError(errorMessage(err, "Failed to approve request.")),
  });

  const pending = data.filter((s) => s.status?.toUpperCase() === "PENDING");

  return (
    <SectionCard
      title="Pending Approvals"
      description="Break-glass requests awaiting a second operator's approval."
      icon={<Clock className="h-4 w-4" />}
    >
      <SessionsStateBlock
        isLoading={isLoading}
        isError={isError && !isLoading}
        onRetry={() => refetch()}
        label="break-glass requests"
      />

      {actionError && (
        <div className="mx-6 mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {actionError}
        </div>
      )}

      {!isLoading && !isError && pending.length === 0 && (
        <div className="py-12 text-center">
          <p className="text-sm text-muted-foreground">
            No pending break-glass requests.
          </p>
        </div>
      )}

      {!isLoading && !isError && pending.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <th className="px-6 py-3">Target Tenant</th>
                <th className="px-6 py-3">Requester UUID</th>
                <th className="px-6 py-3">Ticket Ref</th>
                <th className="px-6 py-3">Reason</th>
                <th className="px-6 py-3">Requested At</th>
                <th className="px-6 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pending.map((s) => {
                const isOwn =
                  currentUserId !== null && s.requested_by === currentUserId;
                const busy =
                  approveMutation.isPending &&
                  approveMutation.variables === s.session_id;
                return (
                  <tr key={s.session_id} className="hover:bg-muted/30">
                    <td className="px-6 py-4 font-mono text-xs text-foreground">
                      {s.target_tenant_id}
                    </td>
                    <td className="max-w-[10rem] px-6 py-4">
                      <span
                        className="block truncate font-mono text-xs text-muted-foreground"
                        title={s.requested_by}
                      >
                        {s.requested_by}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-foreground">
                      {s.ticket_ref}
                    </td>
                    <td className="max-w-xs px-6 py-4 text-sm text-muted-foreground">
                      <span className="line-clamp-2" title={s.reason}>
                        {s.reason}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-muted-foreground">
                      {formatDateTime(s.created_at)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => approveMutation.mutate(s.session_id)}
                        disabled={isOwn || approveMutation.isPending}
                        title={
                          isOwn
                            ? "You cannot approve your own request"
                            : "Approve"
                        }
                        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {busy ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        )}
                        Approve
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}

function ActiveSessionRow({
  session,
  isMine,
  isActiveLocally,
  onRevoke,
  revoking,
}: {
  session: BreakGlassSession;
  isMine: boolean;
  isActiveLocally: boolean;
  onRevoke: (s: BreakGlassSession) => void;
  revoking: boolean;
}) {
  const remaining = useCountdown(session.expires_at);

  return (
    <tr className="hover:bg-muted/30">
      <td className="px-6 py-4 font-mono text-xs text-foreground">
        {session.target_tenant_id}
      </td>
      <td className="px-6 py-4 font-mono text-xs text-foreground">
        {session.ticket_ref}
      </td>
      <td className="whitespace-nowrap px-6 py-4 text-sm text-muted-foreground">
        {formatDateTime(session.expires_at)}
      </td>
      <td
        className="px-6 py-4 font-mono text-sm tabular-nums text-amber-400"
        suppressHydrationWarning
      >
        {remaining === null ? "--:--:--" : formatRemaining(remaining)}
      </td>
      <td className="px-6 py-4">
        <div className="flex justify-end gap-2">
          {isMine && !isActiveLocally && (
            <button
              type="button"
              onClick={() =>
                session.expires_at &&
                setBreakGlassSession({
                  sessionId: session.session_id,
                  tenantId: session.target_tenant_id,
                  expiresAt: session.expires_at,
                })
              }
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-400 transition hover:bg-amber-500/20"
            >
              <LogIn className="h-3.5 w-3.5" />
              Enter
            </button>
          )}
          <button
            type="button"
            onClick={() => onRevoke(session)}
            disabled={revoking}
            className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {revoking && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Revoke
          </button>
        </div>
      </td>
    </tr>
  );
}

function ActiveSessions() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const currentUserId = user?.sub ?? null;
  const localSession = useBreakGlassSession();
  const { data = [], isLoading, isError, refetch } = useBreakGlassSessions();

  const [target, setTarget] = useState<BreakGlassSession | null>(null);
  const [revokeReason, setRevokeReason] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const revokeMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.post(`/v1/operators/break-glass/${id}/revoke`, { reason }),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: BREAK_GLASS_KEY });
      if (localSession?.sessionId === vars.id) {
        // Drop the local session header so we stop sending a dead session.
        clearBreakGlassSession();
      }
      setTarget(null);
      setRevokeReason("");
      setActionError(null);
    },
    onError: (err: unknown) =>
      setActionError(errorMessage(err, "Failed to revoke session.")),
  });

  const now = Date.now();
  const active = data.filter(
    (s) =>
      s.status?.toUpperCase() === "ACTIVE" &&
      (!s.expires_at || new Date(s.expires_at).getTime() > now)
  );

  const reasonValid = revokeReason.trim().length >= 5;

  function closeModal() {
    if (revokeMutation.isPending) return;
    setTarget(null);
    setRevokeReason("");
    setActionError(null);
  }

  return (
    <SectionCard
      title="Active Break-Glass Sessions"
      description="Approved sessions currently granting cross-tenant access."
      icon={<ShieldAlert className="h-4 w-4" />}
    >
      <SessionsStateBlock
        isLoading={isLoading}
        isError={isError && !isLoading}
        onRetry={() => refetch()}
        label="active sessions"
      />

      {!isLoading && !isError && active.length === 0 && (
        <div className="flex flex-col items-center gap-1 py-12 text-center">
          <p className="text-sm font-medium text-foreground">
            No active break-glass sessions
          </p>
          <p className="text-sm text-muted-foreground">
            Approved requests will appear here until they expire or are revoked.
          </p>
        </div>
      )}

      {!isLoading && !isError && active.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <th className="px-6 py-3">Target Tenant</th>
                <th className="px-6 py-3">Ticket</th>
                <th className="px-6 py-3">Expires At</th>
                <th className="px-6 py-3">Countdown</th>
                <th className="px-6 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {active.map((s) => (
                <ActiveSessionRow
                  key={s.session_id}
                  session={s}
                  isMine={currentUserId !== null && s.requested_by === currentUserId}
                  isActiveLocally={localSession?.sessionId === s.session_id}
                  onRevoke={(sess) => {
                    setActionError(null);
                    setTarget(sess);
                  }}
                  revoking={
                    revokeMutation.isPending &&
                    revokeMutation.variables?.id === s.session_id
                  }
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmModal
        isOpen={target !== null}
        onClose={closeModal}
        onConfirm={() => {
          if (target && reasonValid) {
            revokeMutation.mutate({
              id: target.session_id,
              reason: revokeReason.trim(),
            });
          }
        }}
        title="Revoke break-glass session"
        description={
          target ? (
            <>
              This immediately ends access to tenant{" "}
              <span className="font-mono text-zinc-200">
                {target.target_tenant_id}
              </span>{" "}
              (ticket {target.ticket_ref}).
            </>
          ) : (
            ""
          )
        }
        confirmText="Revoke session"
        variant="danger"
        isLoading={revokeMutation.isPending}
        disabled={!reasonValid}
      >
        <label
          htmlFor="bg-revoke-reason"
          className="mb-1.5 block text-sm font-medium text-zinc-300"
        >
          Revoke reason
        </label>
        <textarea
          id="bg-revoke-reason"
          rows={3}
          value={revokeReason}
          onChange={(e) => setRevokeReason(e.target.value)}
          disabled={revokeMutation.isPending}
          placeholder="Why is this session being revoked? (min. 5 characters)"
          className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-rose-500 disabled:opacity-50"
        />
        {actionError && (
          <p className="mt-2 text-xs text-rose-400">{actionError}</p>
        )}
      </ConfirmModal>
    </SectionCard>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OperatorPage() {
  const { can } = useAuth();

  // Scope-based gate: operator:admin is the correct scope from auth.py
  const canAccess = can([SCOPES.OPERATOR_ADMIN]);

  if (!canAccess) {
    return <ForbiddenState />;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Platform Operator
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cross-tenant administration console. Changes made here affect all
          tenants on the platform.
        </p>
      </div>

      {/* Tenant registry */}
      <TenantTable />

      {/* Break-glass console */}
      <BreakGlassRequestForm />
      <PendingApprovals />
      <ActiveSessions />

      {/* Framework creation */}
      <FrameworkForm />
    </div>
  );
}