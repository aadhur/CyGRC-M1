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
 *
 * These are direct client-side calls — no server-side business logic wrapper.
 */

import { useAuth } from "@/lib/auth/context";
import { SCOPES } from "@/lib/auth/permissions";
import { api } from "@/lib/api/client";
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OperatorPage() {
  const { can } = useAuth();

  // Scope-based gate: operator:admin is the correct scope from auth.py
  const canAccess = can([SCOPES.OPERATOR_ADMIN]);

  if (!canAccess) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <ShieldAlert className="h-12 w-12 text-muted-foreground" />
        <div className="text-center">
          <h2 className="text-lg font-semibold text-foreground">
            Access Restricted
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            You need the{" "}
            <code className="text-primary">operator:admin</code> scope to access
            the Platform Operator console.
          </p>
        </div>
      </div>
    );
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

      {/* Framework creation */}
      <FrameworkForm />
    </div>
  );
}
