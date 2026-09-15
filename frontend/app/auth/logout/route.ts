import { NextResponse } from "next/server";
import { keycloakConfig } from "@/lib/auth/config";

export async function GET() {
  const logoutParams = new URLSearchParams({
    post_logout_redirect_uri: keycloakConfig.postLogoutRedirectUri,
    client_id: keycloakConfig.clientId,
  });

  const response = NextResponse.redirect(
    `${keycloakConfig.logoutUrl}?${logoutParams.toString()}`,
  );

  response.cookies.delete("access_token");
  response.cookies.delete("refresh_token");

  return response;
}
