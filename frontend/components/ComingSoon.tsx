import React from "react";
import { FolderLock } from "lucide-react";

export function ComingSoon({
  feature,
  description,
}: {
  feature: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center p-16 bg-surface rounded-xl border border-border text-center shadow-lg my-auto">
      <div className="w-14 h-14 rounded-2xl bg-surface-raised flex items-center justify-center mb-4 text-amber-400 border border-border">
        <FolderLock className="w-7 h-7" />
      </div>
      <span className="text-xs font-mono font-semibold tracking-wider text-amber-500 uppercase">
        NOT YET AVAILABLE
      </span>
      <h2 className="text-xl font-heading font-semibold text-slate-100 mt-2">
        {feature}
      </h2>
      <p className="text-sm text-slate-400 mt-2 max-w-md">
        {description ||
          "This workspace module is currently locked pending scheduled backend release."}
      </p>
    </div>
  );
}