export const SCOPES = {
  CONTROLS_READ: "controls:read",
  CONTROLS_WRITE: "controls:write",

  EVIDENCE_READ: "evidence:read",
  EVIDENCE_WRITE: "evidence:write",
  EVIDENCE_REVIEW: "evidence:review",

  FRAMEWORKS_READ: "frameworks:read",

  USERS_READ: "users:read",
  USERS_WRITE: "users:write",
  USERS_DELETE: "users:delete",

  RISKS_READ: "risks:read",
  RISKS_WRITE: "risks:write",
  RISKS_CLOSE: "risks:close",

  AUDITS_READ: "audits:read",
  AUDITS_WRITE: "audits:write",

  DPDP_READ: "dpdp:read",
  DPDP_WRITE: "dpdp:write",

  AUDITLOG_READ: "auditlog:read",

  OPERATOR_ADMIN: "operator:admin",
  OPERATOR_BREAK_GLASS: "operator:break-glass",
} as const;

export type Scope = (typeof SCOPES)[keyof typeof SCOPES];

export function hasScope(
  userScopes: string[] | undefined,
  requiredScope: Scope,
): boolean {
  return userScopes?.includes(requiredScope) ?? false;
}

export function hasAnyScope(
  userScopes: string[] | undefined,
  requiredScopes: Scope[],
): boolean {
  return requiredScopes.some((scope) => hasScope(userScopes, scope));
}

export function hasAllScopes(
  userScopes: string[] | undefined,
  requiredScopes: Scope[],
): boolean {
  return requiredScopes.every((scope) => hasScope(userScopes, scope));
}

export function getRoleLabel(roles: string[]): string {
  if (roles.length === 0) return "User";

  return roles
    .map((role) =>
      role
        .replace(/[-_]/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase()),
    )
    .join(", ");
}