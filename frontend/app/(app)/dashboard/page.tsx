'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/context';
import { apiClient } from '@/lib/api/client';

interface Control {
  status: string;
}

interface Framework {
  id?: string;
  name: string;
  code: string;
  version: string;
}

interface AuditLog {
  log_id: string;
  action: string;
  target: string;
  status_code: number;
  created_at: string;
}

interface AuditLogResponse {
  audit_logs: AuditLog[];
}

export default function DashboardPage() {
  const { can } = useAuth();

  const [controlCount, setControlCount] = useState(0);
  const [frameworkCount, setFrameworkCount] = useState(0);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  useEffect(() => {
    if (can(['controls:read'])) {
      apiClient<Control[]>('/v1/controls')
        .then((data) => setControlCount(Array.isArray(data) ? data.length : 0))
        .catch(() => setControlCount(0));
    }

    if (can(['frameworks:read'])) {
      apiClient<Framework[]>('/v1/frameworks')
        .then((data) => setFrameworkCount(Array.isArray(data) ? data.length : 0))
        .catch(() => setFrameworkCount(0));
    }

    if (can(['auditlog:read'])) {
      apiClient<AuditLogResponse>('/v1/audit-log')
        .then((data) => setAuditLogs(data.audit_logs?.slice(0, 5) ?? []))
        .catch(() => setAuditLogs([]));
    }
  }, [can]);

  return (
    <main className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-400">
          Overview of your GRC workspace.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {can(['controls:read']) && (
          <DashboardCard
            title="Control Status Summary"
            value={controlCount}
            description="Controls in the library"
          />
        )}

        {can(['frameworks:read']) && (
          <DashboardCard
            title="Frameworks Enabled"
            value={frameworkCount}
            description="Configured frameworks"
          />
        )}

        {can(['auditlog:read']) && (
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-sm font-medium text-slate-400">
              Recent Audit Activity
            </h2>

            <div className="mt-4 space-y-3">
              {auditLogs.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No recent audit activity.
                </p>
              ) : (
                auditLogs.map((log) => (
                  <div
                    key={log.log_id}
                    className="border-b border-slate-800 pb-3 last:border-0"
                  >
                    <p className="text-sm font-medium text-white">
                      {log.action}
                    </p>
                    <p className="mt-1 truncate text-xs text-slate-500">
                      {log.target}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {can(['risks:read']) && (
          <DashboardCard
            title="Risk Summary"
            value="—"
            description="Risk data coming soon"
          />
        )}

        {can(['audits:read']) && (
          <DashboardCard
            title="Open Findings"
            value="—"
            description="Audit findings coming soon"
          />
        )}

        {can(['dpdp:read']) && (
          <DashboardCard
            title="Breach Clock"
            value="—"
            description="DPDP monitoring coming soon"
          />
        )}
      </div>
    </main>
  );
}

function DashboardCard({
  title,
  value,
  description,
}: {
  title: string;
  value: string | number;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
      <h2 className="text-sm font-medium text-slate-400">{title}</h2>
      <p className="mt-3 text-3xl font-semibold text-white">{value}</p>
      <p className="mt-2 text-xs text-slate-500">{description}</p>
    </div>
  );
}