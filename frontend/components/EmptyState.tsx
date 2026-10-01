import { Inbox } from "lucide-react";
import type { ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  className?: string;
}

export function EmptyState({
  title,
  description,
  icon,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`flex min-h-[220px] items-center justify-center p-6 ${className}`}
    >
      <div className="w-full max-w-md text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-500">
          {icon ?? <Inbox className="h-6 w-6" />}
        </div>

        <h3 className="mt-4 text-base font-semibold text-zinc-100">
          {title}
        </h3>

        {description && (
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}

export default EmptyState;