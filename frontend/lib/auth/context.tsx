"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { parseJwt, can as canCheck, canAny as canAnyCheck } from "./permissions";

interface AuthUser {
  userId: string;
  email: string;
  tenantId: string;
  roles: string[];
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  can: (requiredScopes: string[]) => boolean;
  canAny: (scopes: string[]) => boolean;
  logout: () => void;
  setSessionToken: (accessToken: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function readAccessTokenCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(^| )cygrc_access_token=([^;]+)/);
  return match ? decodeURIComponent(match[2]) : null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const applyToken = (rawToken: string | null) => {
    if (!rawToken) {
      setUser(null);
      setToken(null);
      return;
    }
    const payload = parseJwt(rawToken);
    if (!payload) {
      setUser(null);
      setToken(null);
      return;
    }

    const roles: string[] = payload.realm_access?.roles || [];
        const businessRoles = roles.filter(
          (r) => !["offline_access", "uma_authorization"].includes(r) && !r.startsWith("default-roles")
        );

      setUser({
        userId: payload.sub || "",
        email: payload.email || payload.preferred_username || "Operator",
        tenantId: payload.tenant_id || "",
        roles: businessRoles.length > 0 ? businessRoles : ["USER"],
      });
    setToken(rawToken);
  };

  useEffect(() => {
    const existing = readAccessTokenCookie();
    if (existing) {
      applyToken(existing);
    }
    setIsLoading(false);
  }, []);

  const setSessionToken = (accessToken: string) => {
    document.cookie = `cygrc_access_token=${encodeURIComponent(
      accessToken
    )}; Path=/; Max-Age=900; SameSite=Lax`;
    applyToken(accessToken);
  };

  const logout = () => {
    window.location.href = "/auth/logout";
  };

  const checkScope = (requiredScopes: string[]): boolean => {
    if (!user) return false;
    return canCheck(user.roles, requiredScopes);
  };

  const checkAnyScope = (scopes: string[]): boolean => {
    if (!user) return false;
    return canAnyCheck(user.roles, scopes);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        can: checkScope,
        canAny: checkAnyScope,
        logout,
        setSessionToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}