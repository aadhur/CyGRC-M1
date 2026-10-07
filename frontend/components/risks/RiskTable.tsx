"use client";

import React from "react";
import Link from "next/link";
import { getScoreBadge, RISK_STATUS_STYLES } from "@/lib/design/status";
import { ArrowRight } from "lucide-react";

export interface Risk {
  risk_id?: string;
  id?: string;
  title: string;
  likelihood: number;
  impact: number;
  inherent_score?: number;
  status: string;
  treatment?: string | null;
  control_ids?: string[];
  linkedControlsCount?: number;
}

interface RiskTableProps {
  risks: Risk[];
}

export default function RiskTable({ risks }: RiskTableProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-lg">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-raised/60 text-xs font-mono uppercase text-slate-400 border-b border-border">
            <tr>
              <th className="px-6 py-4">Risk</th>
              <th className="px-6 py-4 text-center">Inherent Score</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-center">Linked Controls</th>
              <th className="px-6 py-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {risks.map((risk) => {
              const id = risk.risk_id || risk.id || "";
              const inherentScore = risk.inherent_score ?? risk.likelihood * risk.impact;
              const badge = getScoreBadge(inherentScore);
              const count = risk.control_ids ? risk.control_ids.length : risk.linkedControlsCount || 0;

              return (
                <tr
                  key={id}
                  className="hover:bg-surface-raised/40 transition-colors group cursor-pointer"
                >
                  <td className="px-6 py-4">
                    <Link href={`/risks/${id}`} className="block">
                      <span className="font-semibold text-slate-200 group-hover:text-brand-orange transition-colors">
                        {risk.title}
                      </span>
                      <div className="text-xs font-mono text-slate-500 mt-0.5">
                        Likelihood {risk.likelihood} × Impact {risk.impact} {risk.treatment ? `· ${risk.treatment}` : ""}
                      </div>
                    </Link>
                  </td>

                  <td className="px-6 py-4 text-center">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium tracking-wide ${badge.className}`}>
                      {inherentScore} — {badge.label}
                    </span>
                  </td>

                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium tracking-wide ${RISK_STATUS_STYLES[risk.status?.toUpperCase()] || "bg-slate-800 text-slate-300 border border-slate-700"}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        risk.status?.toUpperCase() === "CLOSED"
                          ? "bg-emerald-400"
                          : risk.status?.toUpperCase() === "TREATING"
                          ? "bg-amber-400"
                          : risk.status?.toUpperCase() === "ACCEPTED"
                          ? "bg-purple-400"
                          : "bg-blue-400"
                      }`} />
                      {risk.status?.toUpperCase() === "OPEN" ? "Open" : risk.status}
                    </span>
                  </td>

                  <td className="px-6 py-4 text-center text-xs font-mono text-slate-400">
                    {count} 
                  </td>

                  <td className="px-6 py-4 text-right">
                    <Link
                      href={`/risks/${id}`}
                      className="inline-flex items-center gap-1 text-xs text-slate-400 group-hover:text-brand-orange transition-colors"
                    >
                      <span>View</span>
                      <ArrowRight size={14} />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export { RiskTable };