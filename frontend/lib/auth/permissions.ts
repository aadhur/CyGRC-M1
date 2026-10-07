export const SCOPES = {
  CONTROLS_READ: "controls:read",
  CONTROLS_WRITE: "controls:write",

  EVIDENCE_READ: "evidence:read",
  EVIDENCE_WRITE: "evidence:write",
  EVIDENCE_REVIEW: "evidence:review",

  FRAMEWORKS_READ: "frameworks:read",
  FRAMEWORKS_WRITE: "frameworks:write",

  USERS_READ: "users:read",
  USERS_WRITE: "users:write",
  USERS_DELETE: "users:delete",

  RISKS_READ: "risks:read",
  RISKS_WRITE: "risks:write",
  RISKS_CLOSE: "risks:close",

  AUDITS_READ: "audits:read",
  AUDITS_WRITE: "audits:write",
  AUDITS_EXPORT: "audits:export",

  DPDP_READ: "dpdp:read",
  DPDP_WRITE: "dpdp:write",

  AUDITLOG_READ: "auditlog:read",

  OPERATOR_ADMIN: "operator:admin",
  OPERATOR_BREAK_GLASS: "operator:break-glass",

  AI_DRAFT: "ai:draft",
  AI_APPROVE: "ai:approve",
} as const;

export type Scope = (typeof SCOPES)[keyof typeof SCOPES];

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
  DPO: [
    "dpdp:read",
    "dpdp:write",
    "controls:read",
    "ai:draft",
  ],
  ENGINEERING_LEAD: [
    "controls:read",
    "evidence:write",
  ],
  USER: [
    "controls:read",
    "evidence:write",
  ],
};

const BREAK_GLASS_READ_SCOPES = [
  "controls:read",
  "evidence:read",
  "risks:read",
  "audits:read",
  "auditlog:read",
  "dpdp:read",
  "frameworks:read",
];

function getActiveBreakGlassScopes(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw =
      sessionStorage.getItem("cygrc_break_glass_session") ||
      localStorage.getItem("cygrc_break_glass_session");
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!parsed.sessionId || !parsed.tenantId) return [];
    if (parsed.expiresAt && new Date(parsed.expiresAt).getTime() < Date.now()) {
      return [];
    }
    return BREAK_GLASS_READ_SCOPES;
  } catch {
    return [];
  }
}

export function hasScope(
  userScopes: string[] | undefined,
  requiredScope: Scope | string
): boolean {
  return userScopes?.includes(requiredScope) ?? false;
}

export function hasAnyScope(
  userScopes: string[] | undefined,
  requiredScopes: (Scope | string)[]
): boolean {
  return requiredScopes.some((scope) => hasScope(userScopes, scope));
}

export function hasAllScopes(
  userScopes: string[] | undefined,
  requiredScopes: (Scope | string)[]
): boolean {
  return requiredScopes.every((scope) => hasScope(userScopes, scope));
}

export function can(userRolesOrScopes: string[] = [], required: string[]): boolean {
  if (!required || required.length === 0) return true;

  const scopes = new Set<string>();

  // 1. Process roles and scopes
  for (const item of userRolesOrScopes) {
    if (item.includes(":")) {
      scopes.add(item);
    }
    const mapped = ROLE_SCOPES[item.toUpperCase()];
    if (mapped) {
      mapped.forEach((s) => scopes.add(s));
    }
  }

  // 2. If Platform Operator has an active Break-Glass session, unlock customer read scopes!
  const isOperator = userRolesOrScopes.some(
    (r) => r.toUpperCase() === "PLATFORM_OPERATOR" || r === "operator:break-glass"
  );
  if (isOperator) {
    const bgScopes = getActiveBreakGlassScopes();
    bgScopes.forEach((s) => scopes.add(s));
  }

  return required.every((s) => scopes.has(s));
}

export function canAny(userRolesOrScopes: string[] = [], scopesToCheck: string[]): boolean {
  if (!scopesToCheck || scopesToCheck.length === 0) return true;

  const scopes = new Set<string>();

  for (const item of userRolesOrScopes) {
    if (item.includes(":")) {
      scopes.add(item);
    }
    const mapped = ROLE_SCOPES[item.toUpperCase()];
    if (mapped) {
      mapped.forEach((s) => scopes.add(s));
    }
  }

  const isOperator = userRolesOrScopes.some(
    (r) => r.toUpperCase() === "PLATFORM_OPERATOR" || r === "operator:break-glass"
  );
  if (isOperator) {
    const bgScopes = getActiveBreakGlassScopes();
    bgScopes.forEach((s) => scopes.add(s));
  }

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