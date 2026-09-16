"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/StatusBadge";
import { apiClient } from "@/lib/api/client";
import { can } from "@/lib/auth/permissions";
import { useAuth } from "@/lib/auth/context";

interface Control {
  control_id: string;
  framework_id: string;
  code: string;
  title: string;
  status: string;
  owner: string | null;
  notes: string | null;
  created_at: string;
}

interface Framework {
  framework_id: string;
  code: string;
  version: string;
  name: string;
}

export default function ControlsPage() {
  const { roles } = useAuth();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [frameworkFilter, setFrameworkFilter] = useState<string>("all");

  const { data: frameworksData } = useQuery({
    queryKey: ["frameworks"],
    queryFn: () =>
      apiClient<{ frameworks: Framework[] }>("/v1/frameworks"),
    enabled: can(roles, ["frameworks:read"]),
  });

  const { data: controlsData, isLoading, error } = useQuery({
    queryKey: ["controls", frameworkFilter],
    queryFn: () => {
      const params =
        frameworkFilter !== "all"
          ? `?framework_id=${frameworkFilter}`
          : "";
      return apiClient<Control[]>(`/v1/controls${params}`);
    },
    enabled: can(roles, ["controls:read"]),
  });

  const filtered = useMemo(() => {
    if (!controlsData) return [];
    const q = search.toLowerCase();
    return controlsData.filter(
      (c) =>
        c.code.toLowerCase().includes(q) ||
        c.title.toLowerCase().includes(q)
    );
  }, [controlsData, search]);

  if (!can(roles, ["controls:read"])) {
    return (
      <div className="p-6 text-muted-foreground">
        You do not have permission to view controls.
      </div>
    );
  }

  if (isLoading) return <div className="p-6">Loading controls...</div>;
  if (error) return <div className="p-6 text-red-500">Failed to load controls.</div>;

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-heading">Controls Library</h1>

      {/* Filter bar */}
      <div className="flex gap-3">
        <Input
          placeholder="Search by code or title..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Select value={frameworkFilter} onValueChange={setFrameworkFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All Frameworks" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Frameworks</SelectItem>
            {frameworksData?.frameworks.map((fw) => (
              <SelectItem key={fw.framework_id} value={fw.framework_id}>
                {fw.code}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3">Code</th>
              <th className="text-left px-4 py-3">Title</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Owner</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((control) => (
              <tr
                key={control.control_id}
                className="border-t border-border hover:bg-muted/50 cursor-pointer"
                onClick={() =>
                  router.push(`/controls/${control.control_id}`)
                }
              >
                <td className="px-4 py-3 font-mono">{control.code}</td>
                <td className="px-4 py-3">{control.title}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={control.status} />
                </td>
                <td className="px-4 py-3">
                  {control.owner ? (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="font-mono text-xs truncate max-w-[120px] block">
                            {control.owner}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>{control.owner}</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-6 text-center text-muted-foreground"
                >
                  No controls found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}