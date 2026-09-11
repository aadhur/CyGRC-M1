/**
 * API Client
 * Centralized HTTP client with automatic token refresh and error handling
 * All API requests go through this client
 */

import { keycloakConfig } from '@/lib/auth/config';

interface RequestOptions extends RequestInit {
  skipAuth?: boolean;
  retryCount?: number;
}

interface ApiResponse<T> {
  data?: T;
  error?: string;
  status: number;
}

const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
};

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
 * Refresh access token using refresh token
 */
async function refreshAccessToken(): Promise<boolean> {
  try {
    const response = await fetch(
      `${keycloakConfig.appUrl}/api/auth/refresh`,
      {
        method: 'POST',
        credentials: 'include', // Include cookies with request
      }
    );

    if (response.ok) {
      return true;
    }

    // Refresh failed, redirect to login
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
    return false;
  } catch (error) {
    console.error('Token refresh failed:', error);
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
    return false;
  }
}

/**
 * Main API request function
 * Automatically adds authorization headers, handles token refresh on 401
 */
export async function apiRequest<T = unknown>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<ApiResponse<T>> {
  const {
    skipAuth = false,
    retryCount = 0,
    headers: customHeaders = {},
    ...fetchOptions
  } = options;

  const url = `${keycloakConfig.apiBaseUrl}${endpoint}`;
  const headers: Record<string, string> = {
    ...DEFAULT_HEADERS,
    ...customHeaders,
  };

  // Add authorization header if not skipped
  if (!skipAuth) {
    const token = getAccessToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      headers,
      credentials: 'include', // Include cookies for refresh token
    });

    // Handle 401 Unauthorized - attempt token refresh
    if (response.status === 401 && !skipAuth && retryCount === 0) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        // Retry the original request once
        return apiRequest<T>(endpoint, {
          ...options,
          retryCount: retryCount + 1,
        });
      }
    }

    // Handle other non-2xx responses
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        error: errorData.message || `HTTP ${response.status}`,
        status: response.status,
      };
    }

    // Parse and return successful response
    const data = await response.json();
    return {
      data,
      status: response.status,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      error: message,
      status: 0,
    };
  }
}

/**
 * GET request helper
 */
export async function apiGet<T = unknown>(
  endpoint: string,
  options?: Omit<RequestOptions, 'method'>
): Promise<ApiResponse<T>> {
  return apiRequest<T>(endpoint, {
    ...options,
    method: 'GET',
  });
}

/**
 * POST request helper
 */
export async function apiPost<T = unknown>(
  endpoint: string,
  body?: unknown,
  options?: Omit<RequestOptions, 'method' | 'body'>
): Promise<ApiResponse<T>> {
  return apiRequest<T>(endpoint, {
    ...options,
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * PATCH request helper
 */
export async function apiPatch<T = unknown>(
  endpoint: string,
  body?: unknown,
  options?: Omit<RequestOptions, 'method' | 'body'>
): Promise<ApiResponse<T>> {
  return apiRequest<T>(endpoint, {
    ...options,
    method: 'PATCH',
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * DELETE request helper
 */
export async function apiDelete<T = unknown>(
  endpoint: string,
  options?: Omit<RequestOptions, 'method'>
): Promise<ApiResponse<T>> {
  return apiRequest<T>(endpoint, {
    ...options,
    method: 'DELETE',
  });
}
