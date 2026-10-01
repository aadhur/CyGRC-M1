"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, PlayCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import BreachClock from "@/components/dpdp/BreachClock";
import BreachStatus, {
  type BreachStatusValue,
} from "@/components/dpdp/BreachStatus";
import ConfirmModal from "@/components/ConfirmModal";
import ForbiddenState from "@/components/ForbiddenState";
import LoadingSkeleton from "@/components/LoadingSkeleton";
import QueryError from "@/components/QueryError";
import { api, ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/context";
import { SCOPES } from "@/lib/auth/permissions";

interface BreachClockResponse {
  status: BreachStatusValue;
  started_at: string | null;
  acknowledged_by: string | null;
  notified_at: string | null;
  deadline: string | null;
  resolved_at: string | null;
  elapsed_seconds: number | null;
}

const BREACH_CLOCK_QUERY_KEY = ["dpdp", "breach-clock"];

function getErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
}

export default function DpdpPage() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [isResolveModalOpen, setIsResolveModalOpen] = useState(false);

  const canRead = can([SCOPES.DPDP_READ]);
  const canWrite = can([SCOPES.DPDP_WRITE]);

  const breachClockQuery = useQuery({
    queryKey: BREACH_CLOCK_QUERY_KEY,
    queryFn: () =>
      api.get<BreachClockResponse>("/v1/dpdp/breach-clock"),
    enabled: canRead,
    retry: false,
  });

  const startMutation = useMutation({
    mutationFn: () =>
      api.post<BreachClockResponse>("/v1/dpdp/breach-clock/start"),
    onSuccess: (data) => {
      queryClient.setQueryData(BREACH_CLOCK_QUERY_KEY, data);
      toast.success("DPDP breach clock started.");
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const resolveMutation = useMutation({
    mutationFn: () =>
      api.post<BreachClockResponse>("/v1/dpdp/breach-clock/resolve"),
    onSuccess: (data) => {
      queryClient.setQueryData(BREACH_CLOCK_QUERY_KEY, data);
      setIsResolveModalOpen(false);
      toast.success("DPDP breach clock resolved.");
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  if (!canRead) {
    return <ForbiddenState />;
  }

  if (breachClockQuery.isLoading) {
    return (
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
            DPDP Compliance Center
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Manage the 72-hour personal data breach notification clock.
          </p>
        </div>

        <LoadingSkeleton rows={3} />
      </div>
    );
  }

  if (breachClockQuery.isError) {
    const error = breachClockQuery.error;

    if (error instanceof ApiError && error.status === 403) {
      return <ForbiddenState />;
    }

    return (
      <div className="p-6">
        <QueryError
          message={getErrorMessage(error)}
          onRetry={() => breachClockQuery.refetch()}
          isRetrying={breachClockQuery.isFetching}
        />
      </div>
    );
  }

  const data = breachClockQuery.data;

  if (!data) {
    return (
      <div className="p-6">
        <QueryError
          message="No breach-clock response was returned by the server."
          onRetry={() => breachClockQuery.refetch()}
          isRetrying={breachClockQuery.isFetching}
        />
      </div>
    );
  }

  const isActive = data.status === "ACTIVE";
  const isInactive = data.status === "INACTIVE";
  const isResolved = data.status === "RESOLVED";

  return (
    <>
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
            DPDP Compliance Center
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Track and manage the mandatory 72-hour personal data breach
            notification clock.
          </p>
        </div>

        {isActive && data.deadline ? (
          <BreachClock deadline={data.deadline} />
        ) : null}

        <BreachStatus
          status={data.status}
          startedAt={data.started_at}
          acknowledgedBy={data.acknowledged_by}
          resolvedAt={data.resolved_at}
          elapsedSeconds={data.elapsed_seconds}
        />

        <div className="flex flex-wrap gap-3">
          {isInactive && canWrite ? (
            <button
              type="button"
              onClick={() => startMutation.mutate()}
              disabled={startMutation.isPending}
              className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <PlayCircle className="h-4 w-4" />
              {startMutation.isPending ? "Declaring..." : "Declare Breach"}
            </button>
          ) : null}

          {isActive && canWrite ? (
            <button
              type="button"
              onClick={() => setIsResolveModalOpen(true)}
              disabled={resolveMutation.isPending}
              className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-emerald-800/70 bg-emerald-950/30 px-5 py-2.5 text-sm font-semibold text-emerald-400 transition hover:bg-emerald-950/60 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4" />
              Resolve Breach
            </button>
          ) : null}

          {!canWrite && (isInactive || isActive) ? (
            <div className="inline-flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/60 px-4 py-2.5 text-sm text-zinc-400">
              <AlertTriangle className="h-4 w-4" />
              You have read-only access to the DPDP compliance center.
            </div>
          ) : null}
        </div>

        {isResolved ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4 text-sm text-zinc-500">
            The previous breach clock is resolved. Declaring another breach
            will start a new 72-hour clock.
          </div>
        ) : null}
      </div>

      <ConfirmModal
        isOpen={isResolveModalOpen}
        onClose={() => {
          if (!resolveMutation.isPending) {
            setIsResolveModalOpen(false);
          }
        }}
        onConfirm={() => resolveMutation.mutate()}
        title="Resolve DPDP breach?"
        description="This will stop the active 72-hour countdown and mark the current breach clock as resolved."
        confirmText="Resolve Breach"
        cancelText="Cancel"
        variant="warning"
        isLoading={resolveMutation.isPending}
      />
    </>
  );
}