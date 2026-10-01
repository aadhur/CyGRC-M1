import { AlertCircle, RefreshCw } from "lucide-react";

interface QueryErrorProps {
  message?: string;
  onRetry: () => void;
  isRetrying?: boolean;
}

export function QueryError({
  message = "Something went wrong while loading this resource.",
  onRetry,
  isRetrying = false,
}: QueryErrorProps) {
  return (
    <div className="flex min-h-[220px] items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-950/80 p-6 text-center shadow-xl">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-amber-800/60 bg-amber-950/40 text-amber-400">
          <AlertCircle className="h-6 w-6" />
        </div>

        <h3 className="mt-4 text-base font-semibold text-zinc-100">
          Unable to load data
        </h3>

        <p className="mt-2 text-sm leading-relaxed text-zinc-400">
          {message}
        </p>

        <button
          type="button"
          onClick={onRetry}
          disabled={isRetrying}
          className="mt-5 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw
            className={`h-4 w-4 ${isRetrying ? "animate-spin" : ""}`}
          />
          {isRetrying ? "Retrying..." : "Retry"}
        </button>
      </div>
    </div>
  );
}

export default QueryError;