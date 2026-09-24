import { NextRequest, NextResponse } from "next/server";
import { AUTH_CONFIG } from "@/lib/auth/config";

export async function GET(request: NextRequest) {
  const refreshToken = request.cookies.get("cygrc_refresh_token")?.value;
  const idToken = request.cookies.get("cygrc_id_token")?.value;

  // 1. Backchannel logout: Revoke the session inside Keycloak
  if (refreshToken) {
    try {
      const params = new URLSearchParams({
        client_id: AUTH_CONFIG.clientId,
        refresh_token: refreshToken,
      });
      await fetch(
        `${AUTH_CONFIG.keycloakBaseUrl}/realms/${AUTH_CONFIG.realm}/protocol/openid-connect/logout`,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: params.toString(),
        }
      );
    } catch (e) {
      console.error("Failed to revoke session at Keycloak:", e);
    }
  }

  // 2. Build browser Keycloak session clear URL
  let keycloakLogoutUrl = `${AUTH_CONFIG.keycloakBaseUrl}/realms/${AUTH_CONFIG.realm}/protocol/openid-connect/logout?client_id=${AUTH_CONFIG.clientId}&post_logout_redirect_uri=${encodeURIComponent(
    `${AUTH_CONFIG.appUrl}/login`
  )}`;
  if (idToken) {
    keycloakLogoutUrl += `&id_token_hint=${idToken}`;
  }

  const response = NextResponse.redirect(keycloakLogoutUrl);

  // 3. Clear all session cookies
  response.cookies.delete("cygrc_access_token");
  response.cookies.delete("cygrc_refresh_token");
  response.cookies.delete("cygrc_id_token");
  response.cookies.delete("access_token"); // Clears the older demo cookie

  return response;
}