import { AUTH_CONFIG } from "@/lib/auth/config";

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return match ? decodeURIComponent(match[2]) : null;
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

  let token = getCookie("cygrc_access_token");

  const headers = new Headers(options.headers || {});
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  let response = await fetch(url, { ...options, headers });

  // 401 Interceptor: Trade refresh token and retry once
  if (response.status === 401) {
    if (!isRefreshing) {
      isRefreshing = true;
      const newToken = await refreshAccessToken();
      isRefreshing = false;
      notifyRefreshed(newToken);

      if (!newToken) {
        if (typeof window !== "undefined") {
          window.location.href = "/login";
        }
        throw new Error("Session expired. Please sign in again.");
      }
      token = newToken;
    } else {
      token = await new Promise<string | null>((resolve) => {
        refreshSubscribers.push(resolve);
      });
      if (!token) {
        throw new Error("Session expired. Please sign in again.");
      }
    }

    const retryHeaders = new Headers(options.headers || {});
    retryHeaders.set("Authorization", `Bearer ${token}`);
    response = await fetch(url, { ...options, headers: retryHeaders });
  }

  if (!response.ok) {
    let errorDetail = "API Request failed";
    try {
      const errJson = await response.json();
      errorDetail = errJson.detail || errJson.message || JSON.stringify(errJson);
    } catch {
      errorDetail = await response.text();
    }
    throw new Error(errorDetail || `HTTP Error ${response.status}`);
  }

  return response.json();
}