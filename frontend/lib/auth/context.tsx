"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  hasAllScopes,
  type Scope,
} from "./permissions";

type AuthUser = {
  sub?: string;
  email?: string;
  name?: string;
  preferred_username?: string;
  tenant_id?: string;
  roles?: string[];
  scopes?: string[];
};

type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  scopes: string[];
  roles: string[];
  tenantId: string | null;
  can: (requiredScopes: Scope[]) => boolean;
  canAny: (scopes: Scope[]) => boolean;
  setSessionToken: (
    accessToken: string,
    refreshToken?: string | null,
  ) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const ROLE_SCOPES: Record<string, string[]> = {
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

function getCookie(name: string): string | null {
  if (typeof document === "undefined") {
    return null;
  }

  const match = document.cookie.match(
    new RegExp("(^|;\\s*)" + name + "=([^;]*)"),
  );

  return match ? decodeURIComponent(match[2]) : null;
}

function decodeToken(token: string): AuthUser | null {
  try {
    const payload = token.split(".")[1];

    if (!payload) {
      return null;
    }

    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(
      base64.length + ((4 - (base64.length % 4)) % 4),
      "=",
    );

    const decoded = JSON.parse(atob(padded));

    const roles: string[] =
      decoded.roles ?? decoded.realm_access?.roles ?? [];

    const tokenScopes: string[] =
      decoded.scopes ??
      (typeof decoded.scope === "string"
        ? decoded.scope.split(" ")
        : []);

    const roleScopes = roles.flatMap(
      (role) => ROLE_SCOPES[String(role).toUpperCase()] ?? [],
    );

    const scopes = Array.from(
      new Set([...tokenScopes, ...roleScopes]),
    );

    return {
      sub: decoded.sub,
      email: decoded.email,
      name: decoded.name,
      preferred_username: decoded.preferred_username,
      tenant_id: decoded.tenant_id,
      roles,
      scopes,
    };
  } catch {
    return null;
  }
}

function decodeAccessToken(): string | null {
  return getCookie("cygrc_access_token") ?? getCookie("access_token");
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const initialToken =
    typeof document !== "undefined" ? decodeAccessToken() : null;

  const [token, setToken] = useState<string | null>(initialToken);
  const [user, setUser] = useState<AuthUser | null>(
    initialToken ? decodeToken(initialToken) : null,
  );

  const setSessionToken = useCallback(
    (accessToken: string, refreshToken?: string | null) => {
      setToken(accessToken);
      setUser(decodeToken(accessToken));

      if (typeof document !== "undefined") {
        const encodedAccessToken = encodeURIComponent(accessToken);

        document.cookie = `cygrc_access_token=${encodedAccessToken}; Path=/; Max-Age=900; SameSite=Lax`;
        document.cookie = `access_token=${encodedAccessToken}; Path=/; Max-Age=900; SameSite=Lax`;

        if (refreshToken) {
          const encodedRefreshToken = encodeURIComponent(refreshToken);

          document.cookie = `cygrc_refresh_token=${encodedRefreshToken}; Path=/; Max-Age=604800; SameSite=Lax`;
          document.cookie = `refresh_token=${encodedRefreshToken}; Path=/; Max-Age=604800; SameSite=Lax`;
        }
      }
    },
    [],
  );

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);

    if (typeof document !== "undefined") {
      document.cookie =
        "cygrc_access_token=; Path=/; Max-Age=0; SameSite=Lax";
      document.cookie =
        "access_token=; Path=/; Max-Age=0; SameSite=Lax";
      document.cookie =
        "cygrc_refresh_token=; Path=/; Max-Age=0; SameSite=Lax";
      document.cookie =
        "refresh_token=; Path=/; Max-Age=0; SameSite=Lax";
    }

    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    const scopes = user?.scopes ?? [];
    const roles = user?.roles ?? [];

    return {
      user,
      token,
      isAuthenticated: Boolean(user && token),
      isLoading: false,
      scopes,
      roles,
      tenantId: user?.tenant_id ?? null,
      can: (requiredScopes) => hasAllScopes(scopes, requiredScopes),
      canAny: (requiredScopes) =>
        requiredScopes.some((scope) => scopes.includes(scope)),
      setSessionToken,
      logout,
    };
  }, [user, token, setSessionToken, logout]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}