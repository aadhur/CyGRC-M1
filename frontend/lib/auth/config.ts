const isServer = typeof window === "undefined";

const serverKeycloakBaseUrl =
  process.env.KEYCLOAK_INTERNAL_URL ||
  process.env.NEXT_PUBLIC_KEYCLOAK_BASE_URL ||
  "http://localhost:8080";

export const AUTH_CONFIG = {
  keycloakBaseUrl: process.env.NEXT_PUBLIC_KEYCLOAK_BASE_URL || "http://localhost:8080",
  serverKeycloakBaseUrl,
  realm: process.env.NEXT_PUBLIC_KEYCLOAK_REALM || "cyart-platform",
  clientId: process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID || "cygrc-app",
  appUrl: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000",

  get callbackUrl() {
    return `${this.appUrl}/auth/callback`;
  },
  get loginUrl() {
    return `${this.keycloakBaseUrl}/realms/${this.realm}/protocol/openid-connect/auth?client_id=${this.clientId}&redirect_uri=${encodeURIComponent(
      this.callbackUrl
    )}&response_type=code&scope=openid&prompt=login`;
  },
  // Used by server route handlers (callback, refresh, logout)
  get tokenEndpoint() {
    const base = isServer ? this.serverKeycloakBaseUrl : this.keycloakBaseUrl;
    return `${base}/realms/${this.realm}/protocol/openid-connect/token`;
  },
  get logoutUrl() {
    return `${this.keycloakBaseUrl}/realms/${this.realm}/protocol/openid-connect/logout?client_id=${this.clientId}&post_logout_redirect_uri=${encodeURIComponent(
      `${this.appUrl}/login`
    )}`;
  },
};