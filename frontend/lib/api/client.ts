import { AUTH_CONFIG } from "@/lib/auth/config";

type RequestOptions = RequestInit & {
  retry?: boolean;
};

export const BREAK_GLASS_STORAGE_KEY = "cygrc_break_glass_session";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;

  const match = document.cookie.match(
    new RegExp("(^| )" + name + "=([^;]+)")
  );

  return match ? decodeURIComponent(match[2]) : null;
}

function getBreakGlassHeader(): Record<string, string> {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.sessionStorage.getItem(BREAK_GLASS_STORAGE_KEY);

    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as { sessionId?: string };

    return parsed?.sessionId
      ? { "X-Break-Glass-Session": parsed.sessionId }
      : {};
  } catch {
    return {};
  }
}

let isRefreshing = false;
let refreshSubscribers: Array<(token: string | null) => void> = [];

function notifyRefreshed(token: string | null) {
  refreshSubscribers.forEach((callback) => callback(token));
  refreshSubscribers = [];
}

async function refreshAccessToken(): Promise<string | null> {
  try {
    const response = await fetch("/api/auth/refresh", {
      method: "POST",
      credentials: "include",
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const newToken = data.access_token || null;

    if (newToken && typeof document !== "undefined") {
      document.cookie = `cygrc_access_token=${encodeURIComponent(
        newToken
      )}; Path=/; Max-Age=900; SameSite=Lax`;
    }

    return newToken;
  } catch {
    return null;
  }
}

export async function apiFetch<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { retry = true, ...fetchOptions } = options;

  const url = endpoint.startsWith("http")
    ? endpoint
    : `${AUTH_CONFIG.apiBaseUrl}${endpoint}`;

  let token = getCookie("cygrc_access_token");

  const isFormData =
    typeof FormData !== "undefined" && fetchOptions.body instanceof FormData;

  const headers = new Headers(fetchOptions.headers || {});

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (!isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const breakGlassHeaders = getBreakGlassHeader();

  Object.entries(breakGlassHeaders).forEach(([key, value]) => {
    if (!headers.has(key)) {
      headers.set(key, value);
    }
  });

  let response = await fetch(url, {
    ...fetchOptions,
    credentials: "include",
    headers,
  });

  if (response.status === 401 && retry) {
    if (!isRefreshing) {
      isRefreshing = true;

      const newToken = await refreshAccessToken();

      isRefreshing = false;
      notifyRefreshed(newToken);

      if (!newToken) {
        if (typeof window !== "undefined") {
          window.location.href = "/login";
        }

        throw new ApiError(
          "Session expired. Please sign in again.",
          401
        );
      }

      token = newToken;
    } else {
      token = await new Promise<string | null>((resolve) => {
        refreshSubscribers.push(resolve);
      });

      if (!token) {
        throw new ApiError(
          "Session expired. Please sign in again.",
          401
        );
      }
    }

    const retryHeaders = new Headers(fetchOptions.headers || {});

    if (token) {
      retryHeaders.set("Authorization", `Bearer ${token}`);
    }

    if (!isFormData && !retryHeaders.has("Content-Type")) {
      retryHeaders.set("Content-Type", "application/json");
    }

    Object.entries(getBreakGlassHeader()).forEach(([key, value]) => {
      if (!retryHeaders.has(key)) {
        retryHeaders.set(key, value);
      }
    });

    response = await fetch(url, {
      ...fetchOptions,
      credentials: "include",
      headers: retryHeaders,
    });
  }

  if (!response.ok) {
    let errorDetail = `API request failed: ${response.status}`;

    try {
      const error = await response.json();

      if (typeof error?.detail === "string") {
        errorDetail = error.detail;
      } else if (typeof error?.message === "string") {
        errorDetail = error.message;
      }
    } catch {
      // Keep the default error message.
    }

    throw new ApiError(errorDetail, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) =>
    apiFetch<T>(path, {
      ...options,
      method: "GET",
    }),

  post: <T>(
    path: string,
    body?: unknown,
    options?: RequestOptions
  ) =>
    apiFetch<T>(path, {
      ...options,
      method: "POST",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),

  patch: <T>(
    path: string,
    body?: unknown,
    options?: RequestOptions
  ) =>
    apiFetch<T>(path, {
      ...options,
      method: "PATCH",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),

  delete: <T>(path: string, options?: RequestOptions) =>
    apiFetch<T>(path, {
      ...options,
      method: "DELETE",
    }),
};