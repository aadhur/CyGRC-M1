import { NextRequest, NextResponse } from "next/server";
import { AUTH_CONFIG } from "@/lib/auth/config";

export async function GET(request: NextRequest) {
  const refreshToken = request.cookies.get("cygrc_refresh_token")?.value;
  const idToken = request.cookies.get("cygrc_id_token")?.value;

  // 1. Backchannel session revocation at Keycloak
  if (refreshToken) {
    try {
      const params = new URLSearchParams({
        client_id: AUTH_CONFIG.clientId,
        refresh_token: refreshToken,
      });

      const logoutEndpoint = `${AUTH_CONFIG.serverKeycloakBaseUrl}/realms/${AUTH_CONFIG.realm}/protocol/openid-connect/logout`;
      await fetch(logoutEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      });
    } catch (err) {
      console.error("Keycloak session revocation failed:", err);
    }
  }

  // 2. Clear browser Keycloak session using id_token_hint
  let redirectTarget = `${AUTH_CONFIG.keycloakBaseUrl}/realms/${AUTH_CONFIG.realm}/protocol/openid-connect/logout?client_id=${AUTH_CONFIG.clientId}&post_logout_redirect_uri=${encodeURIComponent(
    `${AUTH_CONFIG.appUrl}/login`
  )}`;
  if (idToken) {
    redirectTarget += `&id_token_hint=${idToken}`;
  }

  const response = NextResponse.redirect(redirectTarget);

  // 3. Purge BOTH prefixed and legacy duplicate cookies
  const cookiesToPurge = [
    "cygrc_access_token",
    "cygrc_refresh_token",
    "cygrc_id_token",
    "access_token",
    "refresh_token",
    "id_token",
  ];

  for (const name of cookiesToPurge) {
    response.cookies.set(name, "", {
      path: "/",
      expires: new Date(0),
      maxAge: 0,
    });
  }

  return response;
}