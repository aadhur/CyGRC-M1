const KEYCLOAK_BASE_URL =
  process.env.NEXT_PUBLIC_KEYCLOAK_BASE_URL ?? "http://localhost:8080";

const KEYCLOAK_REALM =
  process.env.NEXT_PUBLIC_KEYCLOAK_REALM ?? "cyart-platform";

const KEYCLOAK_CLIENT_ID =
  process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID ?? "cygrc-app";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:8000";

export const keycloakConfig = {
  baseUrl: KEYCLOAK_BASE_URL,
  realm: KEYCLOAK_REALM,
  clientId: KEYCLOAK_CLIENT_ID,
  appUrl: APP_URL,

  get authUrl() {
    return `${KEYCLOAK_BASE_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/auth`;
  },

  get tokenUrl() {
    return `${KEYCLOAK_BASE_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/token`;
  },

  get logoutUrl() {
    return `${KEYCLOAK_BASE_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/logout`;
  },

  get redirectUri() {
    return `${APP_URL}/auth/callback`;
  },

  get postLogoutRedirectUri() {
    return `${APP_URL}/login`;
  },
};

export const AUTH_CONFIG = {
  apiBaseUrl: API_BASE_URL,
  keycloakBaseUrl: KEYCLOAK_BASE_URL,
  realm: KEYCLOAK_REALM,
  clientId: KEYCLOAK_CLIENT_ID,
  appUrl: keycloakConfig.appUrl,

  get serverKeycloakBaseUrl() {
    return keycloakConfig.baseUrl;
  },

  get loginUrl() {
    const params = new URLSearchParams({
      client_id: KEYCLOAK_CLIENT_ID,
      redirect_uri: keycloakConfig.redirectUri,
      response_type: "code",
      scope: "openid",
    });

    return `${keycloakConfig.authUrl}?${params.toString()}`;
  },

  get tokenUrl() {
    return keycloakConfig.tokenUrl;
  },

  get tokenEndpoint() {
    return keycloakConfig.tokenUrl;
  },

  get logoutUrl() {
    return keycloakConfig.logoutUrl;
  },

  get redirectUri() {
    return keycloakConfig.redirectUri;
  },

  get callbackUrl() {
    return keycloakConfig.redirectUri;
  },

  get postLogoutRedirectUri() {
    return keycloakConfig.postLogoutRedirectUri;
  },
};