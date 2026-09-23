"use client";

import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";

import {
  getScopesForRoles,
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
  isAuthenticated: boolean;
  isLoading: boolean;
  scopes: string[];
  roles: string[];
  tenantId: string | null;
  can: (requiredScopes: Scope[]) => boolean;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function decodeAccessToken(): AuthUser | null {
  if (typeof document === "undefined") {
    return null;
  }

  const match = document.cookie.match(
    /(?:^|;\s*)access_token=([^;]*)/,
  );

  if (!match) {
    return null;
  }

  try {
    const token = decodeURIComponent(match[1]);
    const payload = token.split(".")[1];

    if (!payload) {
      return null;
    }

    const decoded = JSON.parse(
      atob(payload.replace(/-/g, "+").replace(/_/g, "/")),
    );

    return {
      sub: decoded.sub,
      email: decoded.email,
      name: decoded.name,
      preferred_username: decoded.preferred_username,
      tenant_id: decoded.tenant_id,
      roles: decoded.roles ?? decoded.realm_access?.roles ?? [],
      scopes:
        decoded.scopes ??
        (typeof decoded.scope === "string"
          ? decoded.scope.split(" ")
          : []),
    };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const user = useMemo(() => decodeAccessToken(), []);

  const logout = () => {
  window.location.href = "/api/auth/logout";
  };

  const value = useMemo<AuthContextValue>(() => {
    const roles = user?.roles ?? [];

    const tokenScopes = user?.scopes ?? [];
    const roleScopes = getScopesForRoles(roles);

    const scopes = [...new Set([...tokenScopes, ...roleScopes])];

    return {
      user,
      isAuthenticated: Boolean(user),
      isLoading: false,
      scopes,
      roles,
      tenantId: user?.tenant_id ?? null,
      can: (requiredScopes) => hasAllScopes(scopes, requiredScopes),
      logout,
    };
  }, [user]);

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