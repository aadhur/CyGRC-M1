"use client";

/**
 * Team Management Page
 *
 * Displays the tenant's user roster and allows inviting / removing members.
 *
 * Permissions (scope-based, §2.7):
 *   - Page access  : users:read
 *   - Invite        : users:write
 *   - Remove        : users:delete
 *
 * The current authenticated user's own account is never removable.
 *
 * Endpoints:
 *   GET    /v1/users
 *   POST   /v1/users/invite
 *   DELETE /v1/users/{id}
 */

import { useAuth } from "@/lib/auth/context";
import { SCOPES } from "@/lib/auth/permissions";
import { api } from "@/lib/api/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { UserPlus, Trash2, ShieldAlert, RefreshCw, X, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type UserStatus = "active" | "suspended" | "invited";

interface TeamMember {
  user_id: string;
  email: string;
  role: string;
  status: UserStatus;
}

interface InvitePayload {
  email: string;
  role: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const AVAILABLE_ROLES = [
  { value: "tenant_admin", label: "Tenant Administrator" },
  { value: "compliance_manager", label: "Compliance Manager" },
  { value: "internal_auditor", label: "Internal Auditor" },
  { value: "risk_owner", label: "Risk Owner" },
  { value: "ciso", label: "CISO" },
  { value: "dpo", label: "Data Protection Officer" },
  { value: "engineering_lead", label: "Engineering Lead" },
  { value: "user", label: "User" },
];

const ROLE_LABELS: Record<string, string> = Object.fromEntries(
  AVAILABLE_ROLES.map(({ value, label }) => [value, label])
);

const STATUS_STYLES: Record<UserStatus, string> = {
  active:    "text-emerald-400 bg-emerald-400/10 ring-emerald-400/20",
  invited:   "text-amber-400  bg-amber-400/10  ring-amber-400/20",
  suspended: "text-zinc-400   bg-zinc-400/10   ring-zinc-400/20",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: UserStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset capitalize",
        STATUS_STYLES[status] ?? "text-zinc-400 bg-zinc-400/10 ring-zinc-400/20"
      )}
    >
      {status}
    </span>
  );
}

function RoleBadge({ role }: { role: string }) {
  return (
    <span className="inline-flex items-center rounded-md bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary ring-1 ring-inset ring-primary/20">
      {ROLE_LABELS[role] ?? role}
    </span>
  );
}

// ─── Invite Modal ─────────────────────────────────────────────────────────────

function InviteModal({
  open,
  onClose,
  onInvite,
  isSubmitting,
}: {
  open: boolean;
  onClose: () => void;
  onInvite: (payload: InvitePayload) => void;
  isSubmitting: boolean;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("user");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("Please enter a valid email address.");
      return;
    }

    onInvite({ email: trimmed, role });
  }

  function handleClose() {
    setEmail("");
    setRole("user");
    setError(null);
    onClose();
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="invite-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h2
              id="invite-dialog-title"
              className="text-lg font-semibold text-foreground"
            >
              Invite team member
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              A temporary password will be communicated outside the application.
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {/* Email */}
          <div>
            <label
              htmlFor="invite-email"
              className="mb-1.5 block text-sm font-medium text-foreground"
            >
              Email address
            </label>
            <input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="colleague@example.com"
              autoComplete="off"
              disabled={isSubmitting}
              className="w-full rounded-lg border border-input bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            />
          </div>

          {/* Role */}
          <div>
            <label
              htmlFor="invite-role"
              className="mb-1.5 block text-sm font-medium text-foreground"
            >
              Role
            </label>
            <div className="relative">
              <select
                id="invite-role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                disabled={isSubmitting}
                className="w-full appearance-none rounded-lg border border-input bg-muted px-3 py-2 pr-8 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
              >
                {AVAILABLE_ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>

          {/* Error */}
          {error && (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              id="invite-submit-btn"
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  Inviting…
                </>
              ) : (
                <>
                  <UserPlus className="h-3.5 w-3.5" />
                  Send invite
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Delete Confirmation Modal ─────────────────────────────────────────────────

function ConfirmDeleteModal({
  member,
  onConfirm,
  onCancel,
  isSubmitting,
}: {
  member: TeamMember;
  onConfirm: () => void;
  onCancel: () => void;
  isSubmitting: boolean;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-delete-title"
      className="fixed inset-0 z-50 flex items-center justify-center"
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
      />
      <div className="relative z-10 w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-2xl">
        <h2
          id="confirm-delete-title"
          className="mb-2 text-base font-semibold text-foreground"
        >
          Remove team member?
        </h2>
        <p className="mb-6 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{member.email}</span>{" "}
          will lose access to this workspace immediately.
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            id="confirm-delete-btn"
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 rounded-lg bg-destructive/90 px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                Removing…
              </>
            ) : (
              <>
                <Trash2 className="h-3.5 w-3.5" />
                Remove
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TeamPage() {
  const { can, user } = useAuth();
  const queryClient = useQueryClient();

  const canRead   = can([SCOPES.USERS_READ]);
  const canWrite  = can([SCOPES.USERS_WRITE]);
  const canDelete = can([SCOPES.USERS_DELETE]);

  const [inviteOpen, setInviteOpen]   = useState(false);
  const [toDelete, setToDelete]       = useState<TeamMember | null>(null);
  const [successMsg, setSuccessMsg]   = useState<string | null>(null);
  const [errorMsg, setErrorMsg]       = useState<string | null>(null);

  // ── Data fetching ─────────────────────────────────────────────────────────

  const {
    data: members = [],
    isLoading,
    isError,
    refetch,
  } = useQuery<TeamMember[]>({
    queryKey: ["team-members"],
    queryFn: () => api.get<TeamMember[]>("/v1/users"),
    enabled: canRead,
  });

  // ── Mutations ──────────────────────────────────────────────────────────────

  const inviteMutation = useMutation({
    mutationFn: (payload: InvitePayload) =>
      api.post<TeamMember>("/v1/users/invite", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
      setInviteOpen(false);
      flash("success", "Invitation sent successfully.");
    },
    onError: (err: Error) => {
      flash("error", err.message ?? "Failed to send invitation.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete<void>(`/v1/users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
      setToDelete(null);
      flash("success", "Member removed.");
    },
    onError: (err: Error) => {
      setToDelete(null);
      flash("error", err.message ?? "Failed to remove member.");
    },
  });

  function flash(type: "success" | "error", msg: string) {
    if (type === "success") {
      setSuccessMsg(msg);
      setTimeout(() => setSuccessMsg(null), 4000);
    } else {
      setErrorMsg(msg);
      setTimeout(() => setErrorMsg(null), 6000);
    }
  }

  // ── Access guard ──────────────────────────────────────────────────────────

  if (!canRead) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <ShieldAlert className="h-12 w-12 text-muted-foreground" />
        <div className="text-center">
          <h2 className="text-lg font-semibold text-foreground">Access Restricted</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            You need the <code className="text-primary">users:read</code> scope to view this page.
          </p>
        </div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Modals */}
      <InviteModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onInvite={(payload) => inviteMutation.mutate(payload)}
        isSubmitting={inviteMutation.isPending}
      />
      {toDelete && (
        <ConfirmDeleteModal
          member={toDelete}
          onConfirm={() => deleteMutation.mutate(toDelete.user_id)}
          onCancel={() => setToDelete(null)}
          isSubmitting={deleteMutation.isPending}
        />
      )}

      <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Team
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage who has access to your organisation&apos;s workspace.
            </p>
          </div>

          {canWrite && (
            <button
              id="invite-member-btn"
              type="button"
              onClick={() => setInviteOpen(true)}
              className="inline-flex items-center gap-2 self-start rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 sm:self-auto"
            >
              <UserPlus className="h-4 w-4" />
              Invite member
            </button>
          )}
        </div>

        {/* Toast banners */}
        {successMsg && (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
            {successMsg}
          </div>
        )}
        {errorMsg && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {errorMsg}
          </div>
        )}

        {/* Card */}
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          {/* Table header */}
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <span className="text-sm font-medium text-muted-foreground">
              {isLoading ? "Loading…" : `${members.length} member${members.length !== 1 ? "s" : ""}`}
            </span>
            <button
              id="refresh-team-btn"
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
                  <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-48 animate-pulse rounded bg-muted" />
                    <div className="h-3 w-24 animate-pulse rounded bg-muted" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Error state */}
          {isError && !isLoading && (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <ShieldAlert className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Failed to load team members.
              </p>
              <button
                type="button"
                onClick={() => refetch()}
                className="text-sm text-primary underline-offset-2 hover:underline"
              >
                Try again
              </button>
            </div>
          )}

          {/* Empty state */}
          {!isLoading && !isError && members.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <p className="text-sm text-muted-foreground">
                No team members found.
              </p>
              {canWrite && (
                <button
                  type="button"
                  onClick={() => setInviteOpen(true)}
                  className="text-sm text-primary underline-offset-2 hover:underline"
                >
                  Invite your first member →
                </button>
              )}
            </div>
          )}

          {/* Table */}
          {!isLoading && !isError && members.length > 0 && (
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  <th className="px-6 py-3">Email</th>
                  <th className="px-6 py-3">Role</th>
                  <th className="px-6 py-3">Status</th>
                  {canDelete && <th className="px-6 py-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {members.map((member) => {
                  const isSelf = member.user_id === user?.sub;

                  return (
                    <tr
                      key={member.user_id}
                      className="transition-colors hover:bg-muted/30"
                    >
                      {/* Email + avatar */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <span
                            aria-hidden="true"
                            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary"
                          >
                            {member.email?.[0]?.toUpperCase() ?? "?"}
                          </span>
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              {member.email}
                            </p>
                            {isSelf && (
                              <p className="text-xs text-muted-foreground">You</p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="px-6 py-4">
                        <RoleBadge role={member.role} />
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4">
                        <StatusBadge status={member.status} />
                      </td>

                      {/* Actions */}
                      {canDelete && (
                        <td className="px-6 py-4 text-right">
                          {!isSelf ? (
                            <button
                              id={`remove-user-${member.user_id}`}
                              type="button"
                              onClick={() => setToDelete(member)}
                              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                              title={`Remove ${member.email}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Remove
                            </button>
                          ) : (
                            <span className="text-xs text-muted-foreground/40">—</span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Informational note about temporary passwords */}
        <p className="text-xs text-muted-foreground">
          Invited accounts are provisioned with a temporary password that is
          communicated to the user outside this application.
        </p>
      </div>
    </>
  );
}
