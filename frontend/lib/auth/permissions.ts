/**
 * Synchronized with backend/core/app/middleware/auth.py
 */
export const ROLE_SCOPES: Record<string, string[]> = {
  PLATFORM_OPERATOR: [
    "operator:admin",
    "operator:break-glass",
    "frameworks:read",
    "frameworks:write",
  ],
  TENANT_ADMIN: [
    "controls:read",
    "controls:write",
    "evidence:read",
    "evidence:write",
    "evidence:review",
    "frameworks:read",
    "auditlog:read",
    "audits:read",
    "audits:write",
    "audits:export",
    "risks:read",
    "risks:write",
    "risks:close",
    "dpdp:read",
    "dpdp:write",
    "users:read",
    "users:write",
    "users:delete",
    "ai:draft",
    "ai:approve",
  ],
  COMPLIANCE_MANAGER: [
    "controls:read",
    "controls:write",
    "evidence:read",
    "evidence:review",
    "frameworks:read",
    "risks:read",
    "risks:close",
    "ai:draft",
    "ai:approve",
  ],
  INTERNAL_AUDITOR: [
    "controls:read",
    "evidence:read",
    "audits:read",
    "audits:write",
    "audits:export",
    "frameworks:read",
  ],
  RISK_OWNER: [
    "controls:read",
    "risks:read",
    "risks:write",
    "evidence:read",
    "risks:close",
    "frameworks:read",
  ],
  CISO: [
    "evidence:review",
    "evidence:read",
    "controls:read",
    "risks:read",
    "audits:read",
    "dpdp:read",
    "auditlog:read",
    "users:read",
    "frameworks:read",
    "risks:close",
  ],
  DPO: ["dpdp:read", "dpdp:write", "controls:read", "ai:draft"],
  ENGINEERING_LEAD: ["controls:read", "evidence:write"],
  USER: ["controls:read", "evidence:write"],
};

export function can(userRoles: string[], required: string[]): boolean {
  if (!required || required.length === 0) return true;
  const scopes = new Set(
    userRoles.flatMap((r) => ROLE_SCOPES[r.toUpperCase()] ?? [])
  );
  return required.every((s) => scopes.has(s));
}

export function canAny(userRoles: string[], scopesToCheck: string[]): boolean {
  if (!scopesToCheck || scopesToCheck.length === 0) return true;
  const scopes = new Set(
    userRoles.flatMap((r) => ROLE_SCOPES[r.toUpperCase()] ?? [])
  );
  return scopesToCheck.some((s) => scopes.has(s));
}

export function parseJwt(token: string): Record<string, any> | null {
  try {
    const base64Url = token.split(".")[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}