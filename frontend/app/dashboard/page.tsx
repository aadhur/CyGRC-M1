"use client";

import { useAuth } from "@/lib/auth/context";

export default function DashboardPage() {
  const { user, isAuthenticated, tenantId, roles, scopes } = useAuth();

  return (
    <main className="min-h-screen bg-background px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">CyGRC Dashboard</h1>
          <p className="mt-2 text-muted-foreground">
            Welcome to your GRC workspace.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-xl border bg-card p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold">Authentication</h2>

            <p className="text-sm">
              Status:{" "}
              <span className="font-medium">
                {isAuthenticated ? "Authenticated" : "Not Authenticated"}
              </span>
            </p>

            <p className="mt-2 text-sm">
              Email: {user?.email ?? "N/A"}
            </p>

            <p className="mt-2 text-sm">
              Username: {user?.preferred_username ?? "N/A"}
            </p>
          </div>

          <div className="rounded-xl border bg-card p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold">Tenant</h2>

            <p className="break-all text-sm">
              Tenant ID: {tenantId ?? "N/A"}
            </p>

            <p className="mt-2 text-sm">
              Roles: {roles.length ? roles.join(", ") : "None"}
            </p>

            <p className="mt-2 text-sm">
              Scopes: {scopes.length ? scopes.join(", ") : "None"}
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
