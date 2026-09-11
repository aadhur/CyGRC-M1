'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface DecodedToken {
  sub: string;
  email: string;
  name: string;
  preferred_username: string;
  roles: string[];
  tenant_id?: string;
  iat: number;
  exp: number;
}

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: DecodedToken | null;
  can: (requiredScopes: string[]) => boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Decode JWT token without verification (client-side)
 * In production, verify tokens server-side when needed
 */
function decodeToken(token: string): DecodedToken | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const decoded = JSON.parse(
      Buffer.from(parts[1], 'base64').toString('utf-8')
    );
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Get access token from cookie
 */
function getAccessToken(): string | null {
  if (typeof document === 'undefined') return null;

  const name = 'access_token=';
  const cookies = document.cookie.split(';');

  for (let cookie of cookies) {
    cookie = cookie.trim();
    if (cookie.indexOf(name) === 0) {
      return cookie.substring(name.length);
    }
  }
  return null;
}

/**
 * AuthProvider Component
 * Provides authentication context to all child components
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<DecodedToken | null>(null);
  const router = useRouter();

  useEffect(() => {
    // Check authentication status on mount
    const token = getAccessToken();
    
    if (token) {
      const decoded = decodeToken(token);
      if (decoded) {
        // Check if token is not expired
        const now = Math.floor(Date.now() / 1000);
        if (decoded.exp > now) {
          setUser(decoded);
          setIsAuthenticated(true);
        } else {
          // Token expired, redirect to login
          setIsAuthenticated(false);
          router.push('/login');
        }
      } else {
        setIsAuthenticated(false);
      }
    }

    setIsLoading(false);
  }, [router]);

  const can = (requiredScopes: string[]): boolean => {
    if (!user) return false;

    // Import permission utilities
    const { can: checkCan } = require('@/lib/auth/permissions');
    return checkCan(user.roles || [], requiredScopes);
  };

  const logout = async () => {
    try {
      // Call backend logout endpoint which clears cookies
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });

      if (response.ok) {
        // Redirect to Keycloak logout (handled by backend)
        window.location.href = '/login';
      }
    } catch (error) {
      console.error('Logout failed:', error);
      // Fallback: redirect to login anyway
      window.location.href = '/login';
    }
  };

  const value: AuthContextType = {
    isAuthenticated,
    isLoading,
    user,
    can,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * useAuth Hook
 * Use this in any component to access authentication context
 *
 * @example
 * const { user, can, logout } = useAuth();
 * if (can(['controls:read'])) {
 *   // Show controls
 * }
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
