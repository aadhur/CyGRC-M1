/**
 * Role-Scope Mapping & Permission Utilities
 * Defines which scopes are assigned to each role
 * All authorization decisions use scopes, never role names directly
 */

export type UserRole = 
  | 'tenant_admin'
  | 'compliance_manager'
  | 'internal_auditor'
  | 'risk_owner'
  | 'ciso'
  | 'dpo'
  | 'engineering_lead'
  | 'user'
  | 'platform_operator';

/**
 * ROLE_SCOPES: Maps each role to its granted scopes
 * This is the single source of truth for authorization
 */
export const ROLE_SCOPES: Record<UserRole, string[]> = {
  tenant_admin: [
    // Full access
    'controls:read',
    'controls:write',
    'evidence:read',
    'evidence:write',
    'evidence:review',
    'frameworks:read',
    'frameworks:write',
    'audits:read',
    'audits:write',
    'risks:read',
    'risks:write',
    'risks:close',
    'dpdp:read',
    'dpdp:write',
    'auditlog:read',
    'users:read',
    'users:write',
    'users:delete',
  ],
  compliance_manager: [
    'controls:read',
    'controls:write',
    'evidence:read',
    'evidence:review',
  ],
  internal_auditor: [
    'controls:read',
    'evidence:read',
    'audits:read',
    'audits:write',
  ],
  risk_owner: [
    'controls:read',
    'risks:read',
    'risks:write',
    'risks:close',
  ],
  ciso: [
    'controls:read',
    'risks:read',
    'audits:read',
    'dpdp:read',
    'auditlog:read',
  ],
  dpo: [
    'dpdp:read',
    'dpdp:write',
    'controls:read',
  ],
  engineering_lead: [
    'controls:read',
    'evidence:write',
  ],
  user: [
    'controls:read',
    'evidence:write',
  ],
  platform_operator: [
    'operator:admin',
    'operator:break-glass',
    'frameworks:read',
  ],
};

/**
 * Check if user has required scopes
 * @param userRoles - Array of role names assigned to the user
 * @param requiredScopes - Array of scopes that must be present (AND logic)
 * @returns true if user has all required scopes, false otherwise
 *
 * @example
 * can(['compliance_manager'], ['controls:read']) // true
 * can(['user'], ['controls:write']) // false
 */
export function can(userRoles: string[], requiredScopes: string[]): boolean {
  if (!userRoles || userRoles.length === 0) {
    return false;
  }

  if (!requiredScopes || requiredScopes.length === 0) {
    return true;
  }

  // Flatten all scopes from assigned roles
  const userScopes = userRoles
    .map((role) => ROLE_SCOPES[role as UserRole] || [])
    .flat();

  // Check if user has ALL required scopes (AND logic)
  return requiredScopes.every((scope) => userScopes.includes(scope));
}

/**
 * Check if user can perform action with ANY of the required scopes
 * @param userRoles - Array of role names assigned to the user
 * @param requiredScopes - Array of scopes (user needs at least one, OR logic)
 * @returns true if user has at least one of the required scopes, false otherwise
 *
 * @example
 * canAny(['user'], ['controls:write', 'controls:admin']) // false
 * canAny(['compliance_manager'], ['controls:write', 'controls:admin']) // true
 */
export function canAny(userRoles: string[], requiredScopes: string[]): boolean {
  if (!userRoles || userRoles.length === 0) {
    return false;
  }

  if (!requiredScopes || requiredScopes.length === 0) {
    return true;
  }

  const userScopes = userRoles
    .map((role) => ROLE_SCOPES[role as UserRole] || [])
    .flat();

  return requiredScopes.some((scope) => userScopes.includes(scope));
}

/**
 * Get all scopes for a user based on their roles
 */
export function getUserScopes(userRoles: string[]): string[] {
  if (!userRoles || userRoles.length === 0) {
    return [];
  }

  return [...new Set(
    userRoles
      .map((role) => ROLE_SCOPES[role as UserRole] || [])
      .flat()
  )];
}

/**
 * Get display label for a role
 */
export function getRoleLabel(role: UserRole): string {
  const labels: Record<UserRole, string> = {
    tenant_admin: 'Tenant Administrator',
    compliance_manager: 'Compliance Manager',
    internal_auditor: 'Internal Auditor',
    risk_owner: 'Risk Owner',
    ciso: 'CISO',
    dpo: 'Data Protection Officer',
    engineering_lead: 'Engineering Lead',
    user: 'User',
    platform_operator: 'Platform Operator',
  };
  return labels[role] || role;
}
