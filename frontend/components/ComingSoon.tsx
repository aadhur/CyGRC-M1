'use client';

import { LockIcon } from 'lucide-react';

interface ComingSoonProps {
  feature: string;
  locked?: boolean;
}

/**
 * ComingSoon Component
 * Shared placeholder for features not yet available
 * Used for locked sidebar entries and placeholder dashboard cards
 */
export default function ComingSoon({
  feature,
  locked = false,
}: ComingSoonProps) {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-slate-950 to-slate-900">
      <div className="text-center max-w-md px-6">
        {locked && (
          <div className="mb-6 flex justify-center">
            <LockIcon className="w-16 h-16 text-amber-500" />
          </div>
        )}

        <h1 className="text-3xl font-bold text-white mb-2">
          {feature}
        </h1>

        <p className="text-slate-400 mb-8">
          {locked
            ? `The ${feature} feature is currently locked and not yet available.`
            : `The ${feature} feature is coming soon. We're working on bringing this to you.`}
        </p>

        <div className="text-sm text-slate-500 border-t border-slate-700 pt-6">
          <p>Check back later for updates.</p>
        </div>
      </div>
    </div>
  );
}
