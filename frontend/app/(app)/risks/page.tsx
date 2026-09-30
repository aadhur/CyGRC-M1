"use client";

import React, { useState, useEffect } from "react";
import RiskTable from "@/components/risks/RiskTable";
import RiskCreateModal from "@/components/risks/RiskCreateModal";

// Replace this with your project's actual path to useAuth if it differs
import { useAuth } from "@/hooks/useAuth"; 

interface Risk {
  id: string;
  title: string;
  description: string;
  likelihood: number;
  impact: number;
  inherentScore: number;
  status: string;
  treatment: string;
  treatmentPlan: string;
  targetCloseDate: string;
  linkedControlsCount: number;
}

export default function RisksPage() {
  // Gracefully fallback if hook return values are temporarily undefined during loading
  const authContext = useAuth() || {};
  const hasPermission = authContext.hasPermission;
  const authLoading = authContext.isLoading ?? false;

  const [risks, setRisks] = useState<Risk[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);

  const canRead = hasPermission ? hasPermission("risks:read") : true; 
  const canWrite = hasPermission ? hasPermission("risks:write") : true;

  const fetchRisks = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/v1/risks", {
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (response.status === 401) {
        setError("Unauthorized. Please log in again.");
        return;
      }
      if (response.status === 403) {
        setError("Forbidden. You do not have permission to view this resource.");
        return;
      }
      if (!response.ok) {
        throw new Error("Failed to fetch risks from the register.");
      }

      const data = await response.json();
      setRisks(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (canRead && !authLoading) {
      fetchRisks();
    }
  }, [canRead, authLoading]);

  if (authLoading || (isLoading && risks.length === 0 && !error)) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-2 text-sm text-muted-foreground">Loading Risk Register...</span>
      </div>
    );
  }

  if (!canRead) {
    return (
      <div className="p-6 text-center border rounded-lg bg-destructive/5 border-destructive/20 max-w-2xl mx-auto mt-12">
        <h2 className="text-lg font-semibold text-destructive">403 - Access Denied</h2>
        <p className="text-sm text-muted-foreground mt-1">You do not have the required permissions (`risks:read`) to view the Risk Register.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center border rounded-lg bg-destructive/5 border-destructive/20 max-w-2xl mx-auto mt-12">
        <h2 className="text-lg font-semibold text-destructive">Error Loading Risks</h2>
        <p className="text-sm text-muted-foreground mt-1">{error}</p>
        <button onClick={fetchRisks} className="mt-4 px-4 py-2 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 transition">
          Retry Connection
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Risk Register</h1>
          <p className="text-sm text-muted-foreground">Identify, evaluate, and monitor organization risks and treatments.</p>
        </div>
        {canWrite && (
          <button
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 px-4 py-2"
          >
            New Risk
          </button>
        )}
      </div>

      {risks.length === 0 ? (
        <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-12 text-center bg-muted/10">
          <div className="text-muted-foreground text-4xl mb-2">⚠️</div>
          <h3 className="font-semibold text-lg">No Risks Found</h3>
          <p className="text-sm text-muted-foreground max-w-sm mt-1">
            Your risk profile is currently empty. Get started by identifying and document your first organizational risk.
          </p>
          {canWrite && (
            <button
              onClick={() => setIsCreateOpen(true)}
              className="mt-4 inline-flex items-center text-sm font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 h-8 px-3 rounded-md transition"
            >
              Add First Risk
            </button>
          )}
        </div>
      ) : (
        <RiskTable risks={risks} />
      )}

      {isCreateOpen && (
        <RiskCreateModal
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          onSuccess={() => {
            setIsCreateOpen(false);
            fetchRisks();
          }}
        />
      )}
    </div>
  );
}

=======
import { ComingSoon } from "@/components/ComingSoon";

export default function RisksPage() {
  return (
    <ComingSoon
      feature="Risk Register"
      description="Track risks with likelihood, impact, inherent/residual scores, and mitigation treatment plans."
    />
  );
}
