"use strict";

import React from "react";

interface Risk {
  id: string;
  title: string;
  likelihood: number;
  impact: number;
  status: string;
  linkedControlsCount: number;
}

interface RiskTableProps {
  risks: Risk[];
}

export default function RiskTable({ risks }: RiskTableProps) {
  
  const getInherentScoreBadge = (score: number) => {
    if (score <= 7) {
      return (
        <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
          Low ({score})
        </span>
      );
    } else if (score >= 8 && score <= 15) {
      return (
        <span className="inline-flex items-center rounded-full bg-yellow-50 px-2 py-1 text-xs font-medium text-yellow-800 ring-1 ring-inset ring-yellow-600/20">
          Medium ({score})
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/20">
          High/Critical ({score})
        </span>
      );
    }
  };

  const getStatusBadge = (status: string) => {
    const formatted = status.toUpperCase();
    if (formatted === "OPEN" || formatted === "ACTIVE") {
      return <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-medium">{status}</span>;
    }
    return <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium">{status}</span>;
  };

  return (
    <div className="rounded-md border bg-card text-card-foreground shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left border-collapse">
          <thead className="bg-muted/50 text-muted-foreground font-medium border-b text-xs uppercase tracking-wider">
            <tr>
              <th className="p-4">Title</th>
              <th className="p-4 text-center">Likelihood</th>
              <th className="p-4 text-center">Impact</th>
              <th className="p-4 text-center">Inherent Score</th>
              <th className="p-4 text-center">Status</th>
              <th className="p-4 text-center">Linked Controls</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {risks.map((risk) => {
              const inherentScore = risk.likelihood * risk.impact;
              return (
                <tr key={risk.id} className="hover:bg-muted/30 transition-colors">
                  <td className="p-4 font-medium max-w-xs truncate">{risk.title}</td>
                  <td className="p-4 text-center">{risk.likelihood}</td>
                  <td className="p-4 text-center">{risk.impact}</td>
                  <td className="p-4 text-center">{getInherentScoreBadge(inherentScore)}</td>
                  <td className="p-4 text-center">{getStatusBadge(risk.status)}</td>
                  <td className="p-4 text-center">
                    <span className="inline-flex items-center justify-center bg-secondary text-secondary-foreground text-xs px-2.5 py-0.5 rounded-full font-mono">
                      {risk.linkedControlsCount || 0}
                    </span>
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
