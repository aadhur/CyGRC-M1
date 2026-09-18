"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/context";

interface Framework {
  framework_id: string;
  code: string;
  version: string;
  name: string;
}

export default function FrameworksPage() {
  const { scopes } = useAuth();

  const { data, isLoading, error } = useQuery({
    queryKey: ["frameworks"],
    queryFn: () =>
      apiClient<{ frameworks: Framework[] }>("/v1/frameworks"),
    enabled: scopes.includes("frameworks:read"),
  });

  if (!scopes.includes("frameworks:read")) {
    return (
      <div className="p-6 text-muted-foreground">
        You do not have permission to view frameworks.
      </div>
    );
  }

  if (isLoading) return <div className="p-6">Loading frameworks...</div>;
  if (error) return <div className="p-6 text-red-500">Failed to load frameworks.</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-heading mb-6">Frameworks</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {data?.frameworks.map((fw) => (
          <div
            key={fw.framework_id}
            className="rounded-lg border border-border bg-card p-5 space-y-1"
          >
            <p className="text-lg font-semibold">{fw.name}</p>
            <p className="text-sm text-muted-foreground font-mono">{fw.code}</p>
            <p className="text-sm text-muted-foreground">v{fw.version}</p>
          </div>
        ))}
      </div>
    </div>
  );
}