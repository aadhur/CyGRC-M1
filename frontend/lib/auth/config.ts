const KEYCLOAK_BASE_URL =
  process.env.NEXT_PUBLIC_KEYCLOAK_BASE_URL ?? "http://localhost:8080";

const KEYCLOAK_REALM =
  process.env.NEXT_PUBLIC_KEYCLOAK_REALM ?? "cyart-platform";

const KEYCLOAK_CLIENT_ID =
  process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID ?? "cygrc-app";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

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