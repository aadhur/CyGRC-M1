'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/context';
import { apiClient } from '@/lib/api/client';

interface AuditLog {
  log_id: string;
  actor_id: string | null;
  action: string;
  target: string;
  status_code: number;
  request_id: string;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

interface AuditLogResponse {
  audit_logs: AuditLog[];
}

export default function AuditLogPage() {
  const { can } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!can(['auditlog:read'])) {
      setLoading(false);
      return;
    }

    apiClient<AuditLogResponse>('/v1/audit-log')
      .then((data) => setLogs(data.audit_logs))
      .catch(() => setError('Failed to load audit logs.'))
      .finally(() => setLoading(false));
  }, [can]);

  if (!can(['auditlog:read'])) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-semibold text-white">Audit Log</h1>
        <p className="mt-2 text-slate-400">
          You do not have permission to view audit logs.
        </p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-white">Audit Log</h1>
        <p className="mt-1 text-sm text-slate-400">
          Review recorded platform activity and state-changing operations.
        </p>
      </div>

      {loading && (
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-6 text-slate-400">
          Loading audit logs...
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-900 bg-red-950/40 p-6 text-red-300">
          {error}
        </div>
      )}

      {!loading && !error && (
        <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-900">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-800 text-slate-400">
              <tr>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Target</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actor</th>
                <th className="px-4 py-3">Request ID</th>
              </tr>
            </thead>

            <tbody>
              {logs.map((log) => (
                <tr
                  key={log.log_id}
                  className="border-b border-slate-800/70 last:border-0"
                >
                  <td className="whitespace-nowrap px-4 py-3 text-slate-300">
                    {new Date(log.created_at).toLocaleString()}
                  </td>

                  <td className="px-4 py-3 font-medium text-white">
                    {log.action}
                  </td>

                  <td className="px-4 py-3 font-mono text-xs text-slate-300">
                    {log.target}
                  </td>

                  <td className="px-4 py-3">
                    <span
                      className={
                        log.status_code >= 200 && log.status_code < 300
                          ? 'text-emerald-400'
                          : 'text-red-400'
                      }
                    >
                      {log.status_code}
                    </span>
                  </td>

                  <td className="max-w-[180px] truncate px-4 py-3 font-mono text-xs text-slate-400">
                    {log.actor_id ?? 'System'}
                  </td>

                  <td className="max-w-[180px] truncate px-4 py-3 font-mono text-xs text-slate-500">
                    {log.request_id}
                  </td>
                </tr>
              ))}

              {logs.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-10 text-center text-slate-500"
                  >
                    No audit log entries found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}