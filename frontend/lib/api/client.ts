import { AUTH_CONFIG } from "@/lib/auth/config";

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
  const match = document.cookie.match(new RegExp("(^|;\\s*)" + name + "=([^;]*)"));
  return match ? decodeURIComponent(match[2]) : null;
}

export function clearDeadBreakGlassSession() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(BREAK_GLASS_STORAGE_KEY);
    localStorage.removeItem(BREAK_GLASS_STORAGE_KEY);
    window.dispatchEvent(new Event("cygrc:break-glass-change"));
  } catch {}
}

export function getActiveBreakGlassSessionId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw =
      sessionStorage.getItem(BREAK_GLASS_STORAGE_KEY) ||
      localStorage.getItem(BREAK_GLASS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed.sessionId) return null;
    if (parsed.expiresAt && new Date(parsed.expiresAt).getTime() < Date.now()) {
      clearDeadBreakGlassSession();
      return null;
    }
    return parsed.sessionId;
  } catch {
    return null;
  }
}

let isRefreshing = false;
let refreshSubscribers: Array<(token: string | null) => void> = [];

function notifyRefreshed(token: string | null) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

async function refreshAccessToken(): Promise<string | null> {
  try {
    const res = await fetch("/api/auth/refresh", {
      method: "POST",
      credentials: "include",
    });
    if (!res.ok) return null;
    const data = await res.json();
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
  options: RequestInit = {}
): Promise<T> {
  const url = endpoint.startsWith("http")
    ? endpoint
    : `${AUTH_CONFIG.apiBaseUrl}${endpoint}`;

  let token = getCookie("cygrc_access_token") || getCookie("access_token");

  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  const headers = new Headers(options.headers || {});

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  // ONLY attach X-Break-Glass-Session to customer tenant endpoints!
  // NEVER send it to /v1/operators/* or /v1/frameworks!
  const isOperatorEndpoint = endpoint.includes("/operators/");
  const isFrameworksEndpoint = endpoint.startsWith("/v1/frameworks");

  const bgSessionId = getActiveBreakGlassSessionId();
  if (bgSessionId && !isOperatorEndpoint && !isFrameworksEndpoint && !headers.has("X-Break-Glass-Session")) {
    headers.set("X-Break-Glass-Session", bgSessionId);
  }

  if (!isFormData && !headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }

  let response = await fetch(url, { ...options, headers });

  // 401 Handler: Silent refresh and retry once
  if (response.status === 401) {
    const isPublicPage =
      typeof window !== "undefined" &&
      (window.location.pathname.startsWith("/login") ||
        window.location.pathname.startsWith("/onboard"));

    if (!isPublicPage) {
      if (!isRefreshing) {
        isRefreshing = true;
        const newToken = await refreshAccessToken();
        isRefreshing = false;
        notifyRefreshed(newToken);

        if (!newToken) {
          if (typeof window !== "undefined") {
            window.location.href = "/login";
          }
          throw new ApiError("Session expired. Please sign in again.", 401);
        }
        token = newToken;
      } else {
        token = await new Promise<string | null>((resolve) => {
          refreshSubscribers.push(resolve);
        });
        if (!token) {
          throw new ApiError("Session expired. Please sign in again.", 401);
        }
      }

      const retryHeaders = new Headers(options.headers || {});
      retryHeaders.set("Authorization", `Bearer ${token}`);
      if (bgSessionId && !isOperatorEndpoint && !isFrameworksEndpoint) {
        retryHeaders.set("X-Break-Glass-Session", bgSessionId);
      }
      response = await fetch(url, { ...options, headers: retryHeaders });
    }
  }

  if (!response.ok) {
    let errorDetail = `API Request failed: ${response.status}`;
    try {
      const errJson = await response.json();
      if (typeof errJson.detail === "string") {
        errorDetail = errJson.detail;
      } else if (Array.isArray(errJson.detail)) {
        errorDetail = errJson.detail
          .map((d: any) => `${d.loc ? d.loc.slice(-1)[0] : "field"}: ${d.msg}`)
          .join(" | ");
      } else if (errJson.detail && typeof errJson.detail === "object") {
        errorDetail = JSON.stringify(errJson.detail);
      } else {
        errorDetail = errJson.message || JSON.stringify(errJson);
      }
    } catch {
      // keep fallback
    }

    // If backend rejects break-glass session as invalid/expired, automatically purge it
    if (response.status === 403 && errorDetail.toLowerCase().includes("break-glass session")) {
      clearDeadBreakGlassSession();
    }

    throw new ApiError(errorDetail, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string, options?: RequestInit) =>
    apiFetch<T>(path, { ...options, method: "GET" }),

  post: <T>(path: string, body?: unknown, options?: RequestInit) =>
    apiFetch<T>(path, {
      ...options,
      method: "POST",
      headers: { "Content-Type": "application/json", ...options?.headers },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),

  patch: <T>(path: string, body?: unknown, options?: RequestInit) =>
    apiFetch<T>(path, {
      ...options,
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...options?.headers },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),

  delete: <T>(path: string, options?: RequestInit) =>
    apiFetch<T>(path, { ...options, method: "DELETE" }),
};